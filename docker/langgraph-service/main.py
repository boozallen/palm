import logging
import os
import uuid
from fastapi import FastAPI, HTTPException, Request

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s:%(name)s:%(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S',
)
# The MCP SSE library logs connection drops as ERROR even when the graph handles
# them gracefully. Suppress to WARNING so they don't alarm users into retrying.
logging.getLogger('mcp.client.sse').setLevel(logging.CRITICAL)
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from psycopg.errors import UndefinedTable
from pydantic import BaseModel
from langgraph.types import Command

from checkpointer import lifespan, get_checkpointer, ensure_setup
from contextlib import asynccontextmanager as _asynccontextmanager
from typing import AsyncIterator as _AsyncIterator
from graphs.agentic_chat import build_agentic_chat_graph, mcp_session_context


@_asynccontextmanager
async def _maybe_mcp_session(has_docs: bool) -> _AsyncIterator[None]:
    if has_docs:
        async with mcp_session_context():
            yield
    else:
        yield

_INTERNAL_API_KEY = os.environ.get('INTERNAL_API_KEY', '')


def _verify_auth(request: Request) -> None:
    if not _INTERNAL_API_KEY:
        raise HTTPException(status_code=500, detail='INTERNAL_API_KEY is not configured')
    auth = request.headers.get('Authorization', '')
    if auth != f'Bearer {_INTERNAL_API_KEY}':
        raise HTTPException(status_code=401, detail='Unauthorized')


app = FastAPI(lifespan=lifespan)

GRAPH_REGISTRY = {
    'agentic_chat': build_agentic_chat_graph,
}


class CreateThreadRequest(BaseModel):
    graph_type: str
    input: dict


class ResumeThreadRequest(BaseModel):
    value: str


def _coerce_messages(messages: list[dict]) -> list[BaseMessage]:
    role_map = {
        'user': HumanMessage,
        'assistant': AIMessage,
        'system': SystemMessage,
    }
    result = []
    for m in messages:
        cls = role_map.get(m.get('role', ''))
        if cls:
            result.append(cls(content=m.get('content', '')))
    return result


def _prepare_input(raw: dict) -> dict:
    prepared = dict(raw)
    if 'messages' in prepared and prepared['messages']:
        if isinstance(prepared['messages'][0], dict):
            prepared['messages'] = _coerce_messages(prepared['messages'])
    prepared.setdefault('pending_artifacts', [])
    prepared.setdefault('chat_id', '')
    return prepared


def _serialize_state(state: dict) -> dict:
    serialized = {}
    for k, v in state.items():
        if k == 'messages':
            serialized[k] = [m.model_dump() if hasattr(m, 'model_dump') else m for m in v]
        else:
            serialized[k] = v
    return serialized


def _is_interrupted(state: any) -> bool:
    return bool(state.tasks and any(
        hasattr(t, 'interrupts') and t.interrupts for t in state.tasks
    ))


@app.post('/threads')
async def create_thread(request: Request, body: CreateThreadRequest):
    _verify_auth(request)
    if body.graph_type not in GRAPH_REGISTRY:
        raise HTTPException(status_code=400, detail=f'Unknown graph type: {body.graph_type}')

    thread_id = str(uuid.uuid4())

    import logging as _logging
    _log = _logging.getLogger(__name__)
    result = None

    for attempt in range(2):
        try:
            checkpointer = await get_checkpointer()
            graph = GRAPH_REGISTRY[body.graph_type](checkpointer)
            config = {'configurable': {'thread_id': thread_id}, 'recursion_limit': 50}
            has_docs = bool(body.input.get('document_ids'))
            prepared = _prepare_input(body.input)
            _log.info('[MAIN] invoking graph graph_type=%s keys=%s', body.graph_type, list(prepared.keys()))
            async with _maybe_mcp_session(has_docs):
                result = await graph.ainvoke(prepared, config=config)
            if result is None:
                _log.error('[MAIN] graph.ainvoke returned None')
                raise HTTPException(status_code=500, detail='Graph returned no result')
            state = await graph.aget_state(config)
            break
        except UndefinedTable:
            if attempt == 0:
                await ensure_setup()
            else:
                raise

    if result is None:
        raise HTTPException(status_code=500, detail='Graph invocation failed — check langgraph-service logs')

    if _is_interrupted(state):
        return {
            'thread_id': thread_id,
            'status': 'interrupted',
            'interrupt_payload': state.tasks[0].interrupts[0].value,
            'state': _serialize_state(state.values),
        }

    return {
        'thread_id': thread_id,
        'status': 'completed',
        'interrupt_payload': None,
        'state': _serialize_state(result),
    }


@app.post('/threads/{thread_id}/resume')
async def resume_thread(request: Request, thread_id: str, body: ResumeThreadRequest, graph_type: str = 'agentic_chat'):
    _verify_auth(request)
    if graph_type not in GRAPH_REGISTRY:
        raise HTTPException(status_code=400, detail=f'Unknown graph type: {graph_type}')

    for attempt in range(2):
        try:
            checkpointer = await get_checkpointer()
            graph = GRAPH_REGISTRY[graph_type](checkpointer)
            config = {'configurable': {'thread_id': thread_id}, 'recursion_limit': 50}
            state = await graph.aget_state(config)
            if not state:
                raise HTTPException(status_code=404, detail='Thread not found')
            resume_doc_ids = state.values.get('document_ids') if state else []
            async with _maybe_mcp_session(bool(resume_doc_ids)):
                result = await graph.ainvoke(Command(resume=body.value), config=config)
            updated_state = await graph.aget_state(config)
            break
        except UndefinedTable:
            if attempt == 0:
                await ensure_setup()
            else:
                raise

    if _is_interrupted(updated_state):
        return {
            'thread_id': thread_id,
            'status': 'interrupted',
            'interrupt_payload': updated_state.tasks[0].interrupts[0].value,
            'state': _serialize_state(updated_state.values),
        }

    return {
        'thread_id': thread_id,
        'status': 'completed',
        'interrupt_payload': None,
        'state': _serialize_state(result),
    }


@app.get('/threads/{thread_id}/state')
async def get_thread_state(request: Request, thread_id: str, graph_type: str = 'agentic_chat'):
    _verify_auth(request)
    if graph_type not in GRAPH_REGISTRY:
        raise HTTPException(status_code=400, detail=f'Unknown graph type: {graph_type}')

    checkpointer = await get_checkpointer()
    graph = GRAPH_REGISTRY[graph_type](checkpointer)
    config = {'configurable': {'thread_id': thread_id}}

    state = await graph.aget_state(config)
    if not state:
        raise HTTPException(status_code=404, detail='Thread not found')

    interrupted = _is_interrupted(state)
    return {
        'thread_id': thread_id,
        'status': 'interrupted' if interrupted else 'completed',
        'interrupt_payload': state.tasks[0].interrupts[0].value if interrupted else None,
        'state': _serialize_state(state.values),
    }


@app.get('/health')
async def health():
    return {'status': 'ok'}
