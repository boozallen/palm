import json
import logging
import os
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import AsyncIterator

import httpx
from mcp import ClientSession
from mcp.client.sse import sse_client

logger = logging.getLogger(__name__)

_NEXT_URL = os.environ.get('NEXTJS_INTERNAL_URL', 'http://frontend:3000')
_API_KEY = os.environ.get('INTERNAL_API_KEY', '')
_MCP_SSE_URL = f'{_NEXT_URL}/api/mcp/sse'

_http_client = httpx.AsyncClient(timeout=5)

# Shared MCP session for the duration of a single graph invocation — avoids
# reconnecting the SSE transport on every tool call.
_mcp_session: ContextVar[ClientSession | None] = ContextVar('_mcp_session', default=None)


@asynccontextmanager
async def mcp_session_context() -> AsyncIterator[None]:
    """Open one MCP SSE connection for the lifetime of a graph invocation."""
    _yielded = False
    _graph_exc: BaseException | None = None
    try:
        async with sse_client(
            url=_MCP_SSE_URL,
            headers={'Authorization': f'Bearer {_API_KEY}'},
            timeout=1800,
            sse_read_timeout=1800,
        ) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                token = _mcp_session.set(session)
                try:
                    _yielded = True
                    yield
                except BaseException as exc:
                    # Capture exceptions thrown by the graph body so we can re-raise
                    # them after the MCP cleanup runs — we must not swallow them.
                    _graph_exc = exc
                    raise
                finally:
                    _mcp_session.reset(token)
    except BaseException as exc:
        if _graph_exc is not None:
            # Exception originated from the graph body, not from MCP — re-raise it.
            raise
        # SSE connection drops in two scenarios:
        #   A) Before yield  — initialization failed; yield now so the graph can still
        #      run using per-call connections via _call_mcp_tool.
        #   B) After yield   — connection dropped during a long artifact generation;
        #      graph already ran, so we just swallow the cleanup error. Yielding again
        #      here would cause asynccontextmanager to raise RuntimeError (double yield),
        #      which propagates as a 500 and causes the worker to retry the whole job.
        logger.warning('[AGENTIC-CHAT] MCP session context error (suppressed): %s', exc)
        if not _yielded:
            yield


async def _call_mcp_tool(tool_name: str, arguments: dict[str, str], timeout: int = 60) -> str:
    """Call a tool via MCP. Reuses the shared session when available, falls back to a fresh connection."""
    session = _mcp_session.get()
    if session is not None:
        try:
            result = await session.call_tool(tool_name, arguments)
            content_text = result.content[0].text if result.content else '{}'
            if result.isError:
                logger.warning('[AGENTIC-CHAT] MCP tool %s error: %s', tool_name, content_text[:200])
            return content_text
        except Exception as e:
            logger.warning('[AGENTIC-CHAT] MCP shared session failed for %s, falling back: %s', tool_name, e)
            _mcp_session.set(None)

    # Fallback: open a fresh connection per call
    for attempt in range(2):
        try:
            async with sse_client(
                url=_MCP_SSE_URL,
                headers={'Authorization': f'Bearer {_API_KEY}'},
                timeout=timeout,
                sse_read_timeout=timeout,
            ) as (read, write):
                async with ClientSession(read, write) as fresh_session:
                    await fresh_session.initialize()
                    result = await fresh_session.call_tool(tool_name, arguments)
                    content_text = result.content[0].text if result.content else '{}'
                    if result.isError:
                        logger.warning('[AGENTIC-CHAT] MCP tool %s error: %s', tool_name, content_text[:200])
                    return content_text
        except Exception as e:
            if attempt == 0:
                logger.warning('[AGENTIC-CHAT] MCP tool %s failed (attempt 1), retrying: %s', tool_name, e)
            else:
                logger.warning('[AGENTIC-CHAT] MCP tool %s failed after 2 attempts: %s', tool_name, e)
                return json.dumps({'error': f'Tool invocation failed: {str(e)}'})


async def _update_job_progress(job_id: str | None, progress: str) -> None:
    if not job_id:
        return
    try:
        await _http_client.post(
            f'{_NEXT_URL}/api/internal/update-job-progress',
            headers={'Authorization': f'Bearer {_API_KEY}'},
            json={'jobId': job_id, 'progress': progress},
        )
    except Exception:
        pass
