import difflib
import json
import logging
import os
import re
from datetime import date, timedelta
from typing import Annotated

import holidays as holidays_lib
import httpx
from langchain_core.tools import tool
from langgraph.prebuilt import InjectedState

from graphs.graph_mcp import _call_mcp_tool, _update_job_progress
from graphs.prompts import _APP_CONTEXT, _ARTIFACT_INSTRUCTIONS
from graphs.state import AgenticChatState
from inference import chat_completion_with_tools

logger = logging.getLogger(__name__)

_NEXT_URL = os.environ.get('NEXTJS_INTERNAL_URL', 'http://frontend:3000')
_API_KEY = os.environ.get('INTERNAL_API_KEY', '')
_CLAUDE_SERVICE_URL = os.environ.get('CLAUDE_SERVICE_URL', 'http://claude-service:8000')
_model_id_cache: dict[str, str] = {}  # internal UUID → external model ID
_last_loaded_command: dict[str, str] = {}  # stores repo_id + command from skill_repo_load_command


@tool
def get_federal_holidays(year: int) -> str:
    """Return the list of US federal holidays for a given year, including their dates
    and names. Use this to identify non-working days when calculating deadlines or
    planning around government closures."""
    us_holidays = holidays_lib.country_holidays('US', subdiv=None, years=year)
    result = sorted({'date': d.isoformat(), 'name': name} for d, name in us_holidays.items())
    return json.dumps({'year': year, 'holidays': result})


@tool
def get_business_days(start_date: str, end_date: str) -> str:
    """Calculate the number of US federal government business days between two dates
    (inclusive of start, exclusive of end), excluding weekends and federal holidays.
    Dates must be in YYYY-MM-DD format. Use this for deadline calculations, billable
    day estimates, or any question about working days remaining."""
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    forward = end >= start
    if not forward:
        start, end = end, start

    years = range(start.year, end.year + 1)
    us_holidays = holidays_lib.country_holidays('US', subdiv=None, years=list(years))

    count = 0
    current = start
    while current < end:
        if current.weekday() < 5 and current not in us_holidays:
            count += 1
        current += timedelta(days=1)

    return json.dumps({
        'start_date': start_date,
        'end_date': end_date,
        'business_days': count if forward else -count,
        'calendar_days': abs((end - start).days),
    })


@tool
async def get_library_documents(
    state: Annotated[AgenticChatState, InjectedState],
) -> str:
    """Get all documents in the user's library, not just the ones in scope for this
    conversation. Use this as a fallback when search returns no useful results.
    If you find documents that seem relevant to the user's question but are not in
    the current document_ids list, tell the user which documents they might want to
    add to the conversation."""
    text = await _call_mcp_tool(
        'get_library_documents',
        {'userId': state['user_id']},
        timeout=30,
    )
    try:
        docs = json.loads(text)
        if isinstance(docs, list):
            logger.info('[AGENTIC-CHAT] get_library_documents returned %d documents', len(docs))
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def get_document_list(
    state: Annotated[AgenticChatState, InjectedState],
) -> str:
    """Get the full list of documents available in this conversation, including their IDs, filenames,
    and for structured data files (Excel/CSV) the complete column schema with dtypes. The document
    filenames are already injected into the system prompt, but call this when you need the column
    schema for a structured file before calling analyze_spreadsheet_data."""
    text = await _call_mcp_tool(
        'get_document_list',
        {'userId': state['user_id'], 'documentIds': json.dumps(state['document_ids'])},
        timeout=30,
    )
    try:
        documents = json.loads(text)
        if isinstance(documents, list):
            logger.info('[AGENTIC-CHAT] get_document_list returned %d documents', len(documents))
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def get_text(
    state: Annotated[AgenticChatState, InjectedState],
) -> str:
    """Return the full plain text of all documents in this conversation. Use this when
    you need complete source material for artifact generation — for example, before
    regenerating a document with additional detail or when search is not returning
    enough coverage. Do not use this for question answering; use search instead."""
    text = await _call_mcp_tool(
        'get_text',
        {
            'userId': state['user_id'],
            'documentIds': json.dumps(state['document_ids']),
        },
        timeout=30,
    )
    try:
        docs = json.loads(text)
        if isinstance(docs, list):
            logger.info('[AGENTIC-CHAT] get_text returned text for %d document(s)', len(docs))
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def get_artifact_text(
    label: str,
    state: Annotated[AgenticChatState, InjectedState],
) -> str:
    """Return the plain text content of a previously generated artifact (Word doc, HTML, etc.)
    in this conversation. Use this before calling create_pptx, create_docx, or any other
    generation tool when the source material is a generated artifact rather than an uploaded
    document — for example, "create a PowerPoint based on the cats document I just made."

    Pass the exact artifact label as shown in the conversation.

    Args:
        label: The exact label of the previously generated artifact (e.g. "Cats: A Love Story").
    """
    chat_id = state.get('chat_id', '')
    if not chat_id:
        return json.dumps({'error': 'No chat_id in state'})

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f'{_NEXT_URL}/api/internal/artifact-text',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json={'chatId': chat_id, 'label': label},
            )
            resp.raise_for_status()
            data = resp.json()

        # Binary artifact (e.g. .docx) — extract text from XML
        if 'binaryContent' in data:
            ext = data.get('extension', '')
            if ext == '.docx':
                import base64
                import io
                import zipfile
                raw = base64.b64decode(data['binaryContent'])
                with zipfile.ZipFile(io.BytesIO(raw)) as z:
                    if 'word/document.xml' in z.namelist():
                        import re
                        xml = z.read('word/document.xml').decode('utf-8', errors='replace')
                        texts = re.findall(r'<w:t(?:\s[^>]*)?>([^<]*)</w:t>', xml)
                        text = ''.join(texts).strip()
                        logger.info('[AGENTIC-CHAT] get_artifact_text label=%r docx chars=%d', label, len(text))
                        return json.dumps({'label': label, 'text': text})
            return json.dumps({'error': f'Cannot extract text from {ext} artifact'})

        text = data.get('text', '')
        logger.info('[AGENTIC-CHAT] get_artifact_text label=%r chars=%d', label, len(text))
        return json.dumps({'label': label, 'text': text})

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return json.dumps({'error': f"Artifact '{label}' not found in this conversation"})
        logger.error('[AGENTIC-CHAT] get_artifact_text HTTP error: %s', e)
        return json.dumps({'error': f'Failed to retrieve artifact: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] get_artifact_text error: %s', e)
        return json.dumps({'error': str(e)})


def _text_diff_stat(before: str, after: str) -> dict[str, int]:
    added = removed = 0
    for line in difflib.ndiff(before.splitlines(), after.splitlines()):
        if line.startswith('+ '):
            added += 1
        elif line.startswith('- '):
            removed += 1
    return {'added': added, 'removed': removed}


_EDIT_ARTIFACT_SYSTEM_PROMPT = (
    'You are editing the content of a {ext} file. You will be given its current content and a '
    'description of the requested changes. Output ONLY the complete updated file content — no '
    'explanation, no markdown code fences, no commentary before or after. Preserve everything '
    'that is not part of the requested change.'
)


@tool
async def edit_artifact(
    artifact_label: str,
    changes: str,
    state: Annotated[AgenticChatState, InjectedState],
) -> str:
    """Edit a previously written inline artifact — a .html, .md, .py, .txt, .json, .yaml, or .mmd
    file written directly into an earlier response in this conversation. Do NOT use this for
    .docx/.xlsx/.pptx — those have their own edit_docx/edit_xlsx/edit_pptx tools.

    Use this whenever the user wants to modify one of these artifacts — e.g. "change the header
    color", "fix the typo in paragraph 2", "add a new section". Never rewrite the whole artifact
    inline just to apply a small change.

    The edited artifact will be automatically attached to your response. After calling this tool,
    write a natural response describing what was changed — do NOT try to include the artifact
    yourself.

    Args:
        artifact_label: Exact label of the previously generated artifact to edit (e.g. "Cats: A Love Story").
        changes: Exact description of what to change, verbatim from the user.
    """
    chat_id = state.get('chat_id', '')
    if not chat_id:
        return json.dumps({'error': 'No chat_id in state'})

    # A same-turn edit sees the freshest content; otherwise fetch what's persisted.
    same_turn_cache = state.get('inline_artifact_content') or {}
    cached = same_turn_cache.get(artifact_label)
    if cached:
        old_content = cached['content']
        ext = cached['ext']
    else:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f'{_NEXT_URL}/api/internal/artifact-text',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'chatId': chat_id, 'label': artifact_label},
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return json.dumps({'error': f'Artifact "{artifact_label}" not found in this conversation'})
            logger.error('[AGENTIC-CHAT] edit_artifact HTTP error fetching source: %s', e)
            return json.dumps({'error': f'Failed to retrieve artifact: {e.response.status_code}'})
        except Exception as e:
            logger.error('[AGENTIC-CHAT] edit_artifact error fetching source: %s', e)
            return json.dumps({'error': str(e)})

        if 'binaryContent' in data:
            return json.dumps({'error': f'"{artifact_label}" is a binary artifact and cannot be edited with this tool.'})
        old_content = data.get('text', '')
        ext = data.get('extension', '.txt')

    job_id = state.get('job_id')
    if job_id:
        await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': f'Editing "{artifact_label}"...'}))

    try:
        response = await chat_completion_with_tools(
            user_id=state['user_id'],
            model_id=state['model_id'],
            messages=[
                {'role': 'system', 'content': _EDIT_ARTIFACT_SYSTEM_PROMPT.format(ext=ext)},
                {'role': 'user', 'content': f'CURRENT CONTENT:\n{old_content}\n\nREQUESTED CHANGES:\n{changes}'},
            ],
            tools=[],
            chat_message_id=state.get('chat_message_id'),
            user_group_id=state.get('user_group_id'),
            step_label=f'Editing "{artifact_label}"',
        )
    except Exception as e:
        logger.error('[AGENTIC-CHAT] edit_artifact completion error: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})

    if response.get('type') != 'text' or not response.get('text'):
        logger.error('[AGENTIC-CHAT] edit_artifact: unexpected completion response %s', str(response)[:200])
        return json.dumps({'error': 'Edit failed: no content returned'})

    new_content = response['text'].strip()
    diff_stat = _text_diff_stat(old_content, new_content)

    return json.dumps({
        'artifacts': {
            'artifact_path': {
                'content': new_content,
                'extension': ext,
                'encoding': 'utf-8',
                'diffStat': diff_stat,
            },
        },
        'errors': {},
    })


@tool
async def search(
    query: str,
    state: Annotated[AgenticChatState, InjectedState],
) -> str:
    """Find evidence relevant to the query in the user's documents. Returns matching
    text passages, plus (in graph mode) matching entities and concepts from the knowledge graph."""
    text = await _call_mcp_tool(
        'search',
        {
            'userId': state['user_id'],
            'query': query,
            'documentIds': json.dumps(state['document_ids']),
            'useGraph': 'true' if state.get('use_graph') else 'false',
            # Lets the frontend attribute this query's embedding cost to the
            # chat message that caused it. Empty when there is no chat message.
            'chatMessageId': state.get('chat_message_id') or '',
            'userGroupId': state.get('user_group_id') or '',
        },
        timeout=60,
    )
    try:
        result = json.loads(text)
        if 'error' in result:
            logger.warning('[AGENTIC-CHAT] search error: %s', result.get('error'))
        else:
            logger.info(
                '[AGENTIC-CHAT] search query=%r chunks=%d entities=%d concepts=%d',
                query,
                len(result.get('chunks', [])),
                len(result.get('entities', [])),
                len(result.get('concepts', [])),
            )
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def search_conversations(
    query: str,
    state: Annotated[AgenticChatState, InjectedState],
    cursor: str = '',
    entity_ids: list[str] = [],
    concept_ids: list[str] = [],
    entity_names: list[str] = [],
    concept_names: list[str] = [],
) -> str:
    """Search the user's prior conversations (chat history) in this app and return
    verbatim conversation excerpts, not documents. Excludes the current conversation.
    Use for questions like "did we discuss X" or "what did we decide about Y".
    Results are paginated: pass the returned nextCursor as cursor to get more.
    entity_ids / concept_ids are graph node IDs from earlier graph results;
    entity_names / concept_names are exact entity or concept names, resolved
    server-side to every matching graph node (aliases also match for entities).
    When any are given, the first page also lists conversations that cited
    those graph nodes, and searchedFor in the response echoes what each id or
    name resolved to. If entityLookupError appears in the response, the entity
    lookup failed and empty entity matches are inconclusive: report the search
    as incomplete rather than concluding nothing was found."""
    args = {
        'userId': state['user_id'],
        'query': query,
        'chatId': state.get('chat_id', ''),
    }
    if cursor:
        args['cursor'] = cursor
    if entity_ids:
        args['entityIds'] = json.dumps(entity_ids)
    if concept_ids:
        args['conceptIds'] = json.dumps(concept_ids)
    if entity_names:
        args['entityNames'] = json.dumps(entity_names)
    if concept_names:
        args['conceptNames'] = json.dumps(concept_names)
    text = await _call_mcp_tool('search_conversations', args, timeout=60)
    try:
        result = json.loads(text)
        if 'error' in result:
            logger.warning('[AGENTIC-CHAT] search_conversations error: %s', result.get('error'))
        else:
            logger.info(
                '[AGENTIC-CHAT] search_conversations results=%d entity_matches=%d '
                'searched_for=%s entity_lookup_error=%s',
                len(result.get('results', [])),
                len(result.get('entityMatches') or []),
                json.dumps(result.get('searchedFor')) if result.get('searchedFor') else 'none',
                result.get('entityLookupError') or 'none',
            )
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def find_artifacts(
    state: Annotated[AgenticChatState, InjectedState],
    label: str = '',
    file_extension: str = '',
    since_days: int = 0,
    cursor: int = -1,
) -> str:
    """Find artifacts the user MADE in prior conversations, such as documents,
    decks, spreadsheets, reports, or other artifacts. This matches artifact titles
    only, not contents. If a title search finds nothing, fall back to
    search_conversations because older artifacts may only be described in conversation
    text. Results include a short contentPreview of each artifact's text (extracted from
    Word, Excel, and PowerPoint files); use it to narrow candidates. When
    several results plausibly match and the user's request does not pin one down, list
    the candidates with their label, date, and source conversation and ask which one
    instead of picking. When the question concerns an artifact's contents, read it with
    get_conversation_artifact before asserting anything about it. Results include
    artifact IDs for get_conversation_artifact."""
    args = {'userId': state['user_id']}
    if label:
        args['label'] = label
    if file_extension:
        args['fileExtension'] = file_extension
    if since_days > 0:
        args['sinceDays'] = str(since_days)
    if cursor >= 0:
        args['cursor'] = str(cursor)
    text = await _call_mcp_tool('find_artifacts', args, timeout=30)
    try:
        result = json.loads(text)
        if 'error' in result:
            logger.warning('[AGENTIC-CHAT] find_artifacts error: %s', result.get('error'))
        else:
            logger.info(
                '[AGENTIC-CHAT] find_artifacts results=%d has_more=%s',
                len(result.get('results', [])),
                result.get('nextCursor') is not None,
            )
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def get_recent_conversations(
    state: Annotated[AgenticChatState, InjectedState],
    since_days: int = 0,
    cursor: str = '',
) -> str:
    """Get a recent-activity overview of the user's prior conversations in this app
    (excluding the current one): title, first/last activity, top referenced entities,
    document IDs, artifacts, and the last message of each. Use for questions like
    "what have I been working on" or "where did we leave off". A value of 0 or an
    omitted since_days uses the default 14-day lookback; paginated via cursor."""
    args = {
        'userId': state['user_id'],
        'chatId': state.get('chat_id', ''),
    }
    if since_days > 0:
        args['sinceDays'] = str(since_days)
    if cursor:
        args['cursor'] = cursor
    text = await _call_mcp_tool('get_recent_conversations', args, timeout=30)
    try:
        result = json.loads(text)
        if 'error' in result:
            logger.warning('[AGENTIC-CHAT] get_recent_conversations error: %s', result.get('error'))
        else:
            logger.info(
                '[AGENTIC-CHAT] get_recent_conversations conversations=%d',
                len(result.get('conversations', [])),
            )
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def get_conversation_messages(
    chat_id: str,
    state: Annotated[AgenticChatState, InjectedState],
    start_position: int = -1,
    end_position: int = -1,
) -> str:
    """Fetch messages from ONE prior conversation by position window. chat_id is the
    prior conversation's ID (from search_conversations or get_recent_conversations —
    not the current conversation). Positions are 0-based and inclusive; -1 or an
    omitted bound is unbounded. Use to pull the surrounding context of a hit."""
    args = {
        'userId': state['user_id'],
        'chatId': chat_id,
    }
    if start_position >= 0:
        args['startPosition'] = str(start_position)
    if end_position >= 0:
        args['endPosition'] = str(end_position)
    text = await _call_mcp_tool('get_conversation_messages', args, timeout=30)
    try:
        result = json.loads(text)
        if 'error' in result:
            logger.warning('[AGENTIC-CHAT] get_conversation_messages error: %s', result.get('error'))
        else:
            logger.info(
                '[AGENTIC-CHAT] get_conversation_messages message_count=%s',
                result.get('messageCount'),
            )
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def get_conversation_artifact(
    artifact_id: str,
    state: Annotated[AgenticChatState, InjectedState],
    cursor: int = -1,
) -> str:
    """Read one artifact created in a prior conversation. Use this to answer
    questions about a previously created artifact's contents instead of guessing
    from conversation excerpts. Artifact IDs come from find_artifacts,
    search_conversations, get_recent_conversations, or get_conversation_messages. When several versions
    share a label, choose using createdAt and the source chat in light of the user's
    question; if that is still ambiguous, ask the user rather than silently taking
    the newest. contentType identifies text, extracted-text (the document text of a Word,
    Excel, or PowerPoint file), generation-script, docx-source-json, or a binary notice. Pass nextCursor as cursor to read further pages. Reading the
    artifact is how you bring its contents into the current conversation."""
    args = {
        'userId': state['user_id'],
        'artifactId': artifact_id,
    }
    if cursor >= 0:
        args['cursor'] = str(cursor)
    text = await _call_mcp_tool('get_conversation_artifact', args, timeout=30)
    try:
        result = json.loads(text)
        if result.get('error') == 'Artifact not found':
            result['hint'] = (
                'Artifact ids must be copied verbatim from a tool result. Re-run '
                'find_artifacts or search_conversations to get a current id.'
            )
            text = json.dumps(result)
        if 'error' in result:
            logger.warning('[AGENTIC-CHAT] get_conversation_artifact error: %s', result.get('error'))
        else:
            logger.info(
                '[AGENTIC-CHAT] get_conversation_artifact content_type=%s has_more=%s',
                result.get('contentType'),
                result.get('nextCursor') is not None,
            )
    except (json.JSONDecodeError, TypeError):
        pass
    return text


@tool
async def cypher_query(
    sub_question: str,
    state: Annotated[AgenticChatState, InjectedState],
) -> str:
    """Run a structural query against the knowledge graph. Takes a natural-language
    sub-question (e.g., "how many entities of type ORGANIZATION", "find the path
    between entity X and entity Y") and returns the matching rows along with the
    generated Cypher."""
    text = await _call_mcp_tool(
        'cypher_query',
        {
            'userId': state['user_id'],
            'query': sub_question,
            'documentIds': json.dumps(state['document_ids']),
            'userGroupId': state.get('user_group_id') or '',
        },
        timeout=120,
    )
    try:
        result = json.loads(text)
        if 'error' in result:
            logger.warning('[AGENTIC-CHAT] cypher_query error: %s', result.get('error'))
        else:
            logger.info('[AGENTIC-CHAT] cypher_query sub_question=%r rowCount=%s', sub_question, result.get('rowCount'))
    except (json.JSONDecodeError, TypeError):
        pass
    return text


def _resolve_document_id(filename_or_id: str, state: AgenticChatState) -> str | None:
    """Resolve a filename or UUID to a document UUID. Returns None if unresolvable."""
    structured_docs: list[dict] = state.get('structured_docs') or []
    # Already a UUID — verify it exists in scope
    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', filename_or_id, re.IGNORECASE):
        return filename_or_id
    # Filename — look it up
    matched = next((d['id'] for d in structured_docs if d.get('filename') == filename_or_id), None)
    if matched:
        return matched
    # Only one structured doc — unambiguous
    if len(structured_docs) == 1:
        return structured_docs[0]['id']
    return None


@tool
async def analyze_spreadsheet_data(
    filename: str,
    question: str,
    state: Annotated[AgenticChatState, InjectedState],
) -> str:
    """Run quantitative analysis against a structured data document (Excel or CSV) by executing
    Python pandas code. Pass the filename exactly as returned by get_document_list."""
    document_id = _resolve_document_id(filename, state)
    if not document_id:
        return json.dumps({'error': f'Could not resolve {filename!r} to a document — call get_document_list first'})
    args: dict[str, str] = {
        'userId': state['user_id'],
        'documentId': document_id,
        'question': question,
        'modelId': state['model_id'],
        'chatMessageId': state.get('chat_message_id') or '',
        'userGroupId': state.get('user_group_id') or '',
    }
    if state.get('job_id'):
        args['jobId'] = state['job_id']
    text = await _call_mcp_tool('analyze_spreadsheet_data', args, timeout=300)
    try:
        result = json.loads(text)
        if 'error' in result:
            logger.warning('[AGENTIC-CHAT] analyze_spreadsheet_data error: %s', result.get('error'))
        else:
            logger.info('[AGENTIC-CHAT] analyze_spreadsheet_data success document_id=%s question=%r', document_id, question)
        # Embed the resolved document_id so collect_citations_node doesn't have to re-resolve it
        if isinstance(result, dict):
            result['_documentId'] = document_id
            text = json.dumps(result)
    except (json.JSONDecodeError, TypeError):
        pass
    return text



@tool
async def create_docx(
    title: str,
    state: Annotated[AgenticChatState, InjectedState],
    content: str = '',
) -> str:
    """Create a NEW professionally formatted Word document (.docx) with proper headings, tables, and styles.

    Use this ONLY when the user asks for a brand-new document — a report, memo, brief, white paper,
    or any written deliverable that should be a Word file.

    To modify or edit an existing document (one already generated in this conversation or uploaded
    by the user), use `edit_docx` instead — NEVER use this tool to apply changes to an existing doc.

    If the source material is a previously generated artifact in this conversation (e.g. "based on
    the fleet report"), call get_artifact_text first to retrieve its full text, then pass that
    text as part of the content argument.

    The generated document will be automatically attached to your response. After calling
    this tool, write a natural response describing what was created — do NOT try to include
    the artifact yourself.

    Args:
        title: Title for the document (appears on cover page).
        content: Your synthesized findings — the key facts, data, quotes, and structure you want in the document.
    """
    job_id = state.get('job_id')
    document_ids = state.get('document_ids') or []
    if document_ids:
        if job_id:
            await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': f'Reading {len(document_ids)} source document(s)...'}))
        try:
            raw_text = await _call_mcp_tool(
                'get_text',
                {
                    'userId': state['user_id'],
                    'documentIds': json.dumps(document_ids),
                },
                timeout=30,
            )
            _MAX_CHARS = 600_000
            if len(raw_text) <= _MAX_CHARS:
                content = f'{content}\n\nREFERENCE SOURCE DOCUMENTS (use to verify and supplement the above):\n{raw_text}'
                logger.info('[AGENTIC-CHAT] create_docx: fetched full doc text for %d document(s) (%d chars)', len(document_ids), len(raw_text))
            else:
                logger.warning('[AGENTIC-CHAT] create_docx: doc text too large (%d chars), using model content', len(raw_text))
        except Exception as exc:
            logger.warning('[AGENTIC-CHAT] create_docx: get_text failed, using model content: %s', exc)

    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            logger.warning('Failed to resolve model ID %s, using as-is this call', model_id)
    external_model_id = _model_id_cache.get(model_id, model_id)

    payload = {
        'model_id': external_model_id,
        'internal_model_id': model_id,
        'user_id': state['user_id'],
        'chat_message_id': state.get('chat_message_id'),
        'user_group_id': state.get('user_group_id'),
        'content': content,
        'title': title,
        'job_id': state.get('job_id'),
    }
    if job_id:
        await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': 'Sending to document generation agent...'}))
    try:
        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f'{_CLAUDE_SERVICE_URL}/create-docx',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            artifacts = result.get('artifacts', {})
            source_script = result.get('source_script')
            section_count = result.get('section_count')
            artifact_contents = {
                'docx_path': {
                    'content': artifacts.get('content', ''),
                    'extension': artifacts.get('extension', '.docx'),
                    'encoding': artifacts.get('encoding', 'base64'),
                    'source_script': source_script,
                    'section_count': section_count,
                },
            }
            return json.dumps({'artifacts': artifact_contents, 'errors': {}})
    except httpx.HTTPStatusError as e:
        logger.error('[AGENTIC-CHAT] create_docx HTTP error: %s %s', e.response.status_code, e.response.text[:200])
        return json.dumps({'error': f'Generation failed: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] create_docx error: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})


@tool
async def create_xlsx(
    title: str,
    state: Annotated[AgenticChatState, InjectedState],
    content: str = '',
) -> str:
    """Create a professionally formatted Excel spreadsheet (.xlsx) with formulas, formatting, and multiple sheets.

    Use this when the user asks for a spreadsheet, workbook, tracker, financial model, budget,
    data table, or any deliverable that should be an Excel file. This tool sends your content to a
    dedicated spreadsheet-generation subagent powered by openpyxl.

    The generated spreadsheet will be automatically attached to your response. After calling this
    tool, write a natural response describing what was created — do NOT try to include the artifact yourself.

    Args:
        title: Title / filename for the spreadsheet.
        content: Your synthesized content describing what the spreadsheet should contain — sheets,
            columns, data, formulas, and any specific formatting requirements. Be as specific as
            possible. Include all data the user provided.
    """
    job_id = state.get('job_id')
    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            logger.warning('Failed to resolve model ID %s, using as-is', model_id)
    external_model_id = _model_id_cache.get(model_id, model_id)

    payload = {
        'model_id': external_model_id,
        'user_id': state['user_id'],
        'chat_message_id': state.get('chat_message_id'),
        'user_group_id': state.get('user_group_id'),
        'content': content,
        'title': title,
        'job_id': job_id,
    }
    if job_id:
        await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': 'Sending to spreadsheet generation agent...'}))
    try:
        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f'{_CLAUDE_SERVICE_URL}/create-xlsx',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            artifacts = result.get('artifacts', {})
            source_script = result.get('source_script')
            artifact_contents = {
                'xlsx_path': {
                    'content': artifacts.get('content', ''),
                    'extension': artifacts.get('extension', '.xlsx'),
                    'encoding': artifacts.get('encoding', 'base64'),
                    'source_script': source_script,
                },
            }
            return json.dumps({'artifacts': artifact_contents, 'errors': {}})
    except httpx.HTTPStatusError as e:
        logger.error('[AGENTIC-CHAT] create_xlsx HTTP error: %s %s', e.response.status_code, e.response.text[:200])
        return json.dumps({'error': f'Generation failed: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] create_xlsx error: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})


@tool
async def edit_docx(
    changes: str,
    state: Annotated[AgenticChatState, InjectedState],
    artifact_label: str = '',
) -> str:
    """Edit a previously generated or uploaded Word document (.docx).

    Use this when the user wants to modify an existing document — e.g. "change the title",
    "remove the bullets in section 2", "add an executive summary", "reformat the table".

    For a document generated earlier in this conversation, pass its label in `artifact_label`.
    For an uploaded document (selected from the document library), leave `artifact_label` empty
    and the tool will use the uploaded source text directly to produce a revised document.

    The edited document will be automatically attached to your response. After calling
    this tool, write a natural response describing what was changed — do NOT try to include
    the artifact yourself.

    Args:
        changes: Exact description of what to change, verbatim from the user.
        artifact_label: Label of a previously generated .docx artifact to edit (e.g. "Market Analysis Report"). Leave empty when editing an uploaded document.
    """
    job_id = state.get('job_id')
    document_ids = state.get('document_ids') or []
    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            logger.warning('Failed to resolve model ID %s, using as-is this call', model_id)
    external_model_id = _model_id_cache.get(model_id, model_id)

    # Path A — editing a previously generated artifact: fetch its source script (or binary fallback)
    if artifact_label:
        if job_id:
            await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': f'Retrieving source for "{artifact_label}"...'}))
        data_b64 = None
        filename = f'{artifact_label}.docx'
        try:
            chat_id = state.get('chat_id', '')
            async with httpx.AsyncClient(timeout=10) as client:
                src_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/artifact-source',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'chatId': chat_id, 'label': artifact_label},
                )
                src_resp.raise_for_status()
                src_data = src_resp.json()
                if src_data.get('binaryContent'):
                    data_b64 = src_data['binaryContent']
                    filename = src_data.get('filename', filename)
        except Exception as exc:
            logger.warning('[AGENTIC-CHAT] edit_docx: could not fetch source for "%s": %s', artifact_label, exc)
        if not data_b64:
            return json.dumps({'error': f'Could not retrieve source document "{artifact_label}". It may not have been generated in this conversation, or may not support editing.'})

        try:
            request_body: dict = {
                'model_id': external_model_id,
                'user_id': state['user_id'],
                'chat_message_id': state.get('chat_message_id'),
                'user_group_id': state.get('user_group_id'),
                'changes': changes,
                'job_id': state.get('job_id'),
                'data_b64': data_b64,
                'filename': filename,
            }
            async with httpx.AsyncClient(timeout=1800) as client:
                resp = await client.post(
                    f'{_CLAUDE_SERVICE_URL}/edit-docx',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json=request_body,
                )
                resp.raise_for_status()
                result = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error('[AGENTIC-CHAT] edit_docx HTTP error: %s %s', e.response.status_code, e.response.text[:200])
            return json.dumps({'error': f'Edit failed: {e.response.status_code}'})
        except Exception as e:
            logger.error('[AGENTIC-CHAT] edit_docx error: %s', e, exc_info=True)
            return json.dumps({'error': str(e)})

    else:
        # Path B — editing an uploaded document: pass raw file bytes to subagent
        if not document_ids:
            return json.dumps({'error': 'No document label provided and no uploaded documents are in scope. Please specify the label of the document to edit.'})

        doc_data_b64 = None
        doc_filename = ''
        for doc_id in document_ids:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    src_resp = await client.post(
                        f'{_NEXT_URL}/api/internal/document-source',
                        headers={'Authorization': f'Bearer {_API_KEY}'},
                        json={'documentId': doc_id},
                    )
                    src_resp.raise_for_status()
                    resp_data = src_resp.json()
                    doc_data_b64 = resp_data.get('binaryContent') or resp_data.get('sourceJson')
                    doc_filename = resp_data.get('filename', '')
                    if doc_data_b64:
                        break
            except Exception as exc:
                logger.warning('[AGENTIC-CHAT] edit_docx: document-source failed for %s: %s', doc_id, exc)

        if not doc_data_b64:
            return json.dumps({'error': 'STOP. Do not attempt to recreate this document with create_docx. Tell the user: "This document cannot be edited directly. Please describe what you want and I will create a new document."'})

        try:
            async with httpx.AsyncClient(timeout=1800) as client:
                resp = await client.post(
                    f'{_CLAUDE_SERVICE_URL}/edit-docx',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={
                        'model_id': external_model_id,
                        'user_id': state['user_id'],
                        'chat_message_id': state.get('chat_message_id'),
                        'user_group_id': state.get('user_group_id'),
                        'data_b64': doc_data_b64,
                        'filename': doc_filename,
                        'changes': changes,
                        'job_id': state.get('job_id'),
                    },
                )
                resp.raise_for_status()
                result = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error('[AGENTIC-CHAT] edit_docx (upload path) HTTP error: %s %s', e.response.status_code, e.response.text[:200])
            return json.dumps({'error': f'Edit failed: {e.response.status_code}'})
        except Exception as e:
            logger.error('[AGENTIC-CHAT] edit_docx (upload path) error: %s', e, exc_info=True)
            return json.dumps({'error': str(e)})

    artifacts = result.get('artifacts', {})
    source_script_out = result.get('source_script')
    section_count = result.get('section_count')
    artifact_contents = {
        'docx_path': {
            'content': artifacts.get('content', ''),
            'extension': artifacts.get('extension', '.docx'),
            'encoding': artifacts.get('encoding', 'base64'),
            'source_script': source_script_out,
            'section_count': section_count,
            'diffStat': result.get('diffStat'),
        },
    }
    return json.dumps({'artifacts': artifact_contents, 'errors': {}})


@tool
async def edit_xlsx(
    changes: str,
    state: Annotated[AgenticChatState, InjectedState],
    artifact_label: str = '',
) -> str:
    """Edit an Excel spreadsheet (.xlsx) — either previously generated or uploaded.

    Use this when the user wants to modify an existing spreadsheet — e.g. "add a totals row",
    "change the color scheme", "add a new sheet", "update the formulas in column D".

    For a spreadsheet generated earlier in this conversation, pass its label in `artifact_label`.
    For an uploaded spreadsheet (selected from the document library), leave `artifact_label` empty
    and the tool will use the uploaded data directly to produce a revised spreadsheet.

    The edited spreadsheet will be automatically attached to your response. After calling
    this tool, write a natural response describing what was changed — do NOT try to include
    the artifact yourself.

    Args:
        changes: Exact description of what to change, verbatim from the user.
        artifact_label: Label of a previously generated .xlsx artifact to edit (e.g. "Q3 Budget"). Leave empty when editing an uploaded spreadsheet.
    """
    job_id = state.get('job_id')
    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            logger.warning('Failed to resolve model ID %s, using as-is this call', model_id)
    external_model_id = _model_id_cache.get(model_id, model_id)

    document_ids = state.get('document_ids') or []

    if artifact_label:
        # Path A — editing a previously generated artifact: fetch its source script
        if job_id:
            await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': f'Retrieving source for "{artifact_label}"...'}))
        try:
            chat_id = state.get('chat_id', '')
            async with httpx.AsyncClient(timeout=10) as client:
                src_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/artifact-source',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'chatId': chat_id, 'label': artifact_label},
                )
                src_resp.raise_for_status()
                source_script = src_resp.json().get('sourceScript')
        except Exception as exc:
            logger.warning('[AGENTIC-CHAT] edit_xlsx: could not fetch source script for "%s": %s', artifact_label, exc)
            return json.dumps({'error': f'Could not retrieve source spreadsheet "{artifact_label}". It may not have been generated in this conversation, or may not support editing.'})

        if not source_script:
            # Fall through to check artifact_script_map in state (same-turn edit)
            script_map = state.get('artifact_script_map') or {}
            entry = script_map.get(artifact_label) or {}
            source_script = entry.get('script')

        if not source_script:
            return json.dumps({'error': f'No editable source script found for "{artifact_label}". Only spreadsheets generated in this conversation can be edited.'})

        title = artifact_label
    else:
        # Path B — editing an uploaded xlsx: rebuild from extracted text
        if not document_ids:
            return json.dumps({'error': 'No spreadsheet label provided and no uploaded documents are in scope. Please specify the label of the spreadsheet to edit.'})

        doc_text = None
        doc_filename = ''
        for doc_id in document_ids:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    src_resp = await client.post(
                        f'{_NEXT_URL}/api/internal/document-source',
                        headers={'Authorization': f'Bearer {_API_KEY}'},
                        json={'documentId': doc_id},
                    )
                    src_resp.raise_for_status()
                    data = src_resp.json()
                    fname = data.get('filename', '')
                    if data.get('text') and fname.lower().endswith(('.xlsx', '.csv')):
                        doc_text = data['text']
                        doc_filename = fname
                        break
            except Exception as exc:
                logger.warning('[AGENTIC-CHAT] edit_xlsx: document-source failed for %s: %s', doc_id, exc)

        if not doc_text:
            return json.dumps({'error': 'No uploadable Excel or CSV spreadsheet found in scope. Please select an .xlsx or .csv file from the document library.'})

        title = doc_filename.rsplit('.', 1)[0] if doc_filename else ''

    try:
        import base64 as _b64
        request_body: dict = {
            'model_id': external_model_id,
            'user_id': state['user_id'],
            'chat_message_id': state.get('chat_message_id'),
            'user_group_id': state.get('user_group_id'),
            'changes': changes,
            'title': title,
            'job_id': state.get('job_id'),
        }
        if artifact_label:
            request_body['source_script'] = source_script
        else:
            request_body['data_b64'] = _b64.b64encode(doc_text.encode()).decode()
            request_body['filename'] = doc_filename

        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f'{_CLAUDE_SERVICE_URL}/edit-xlsx',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json=request_body,
            )
            resp.raise_for_status()
            result = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error('[AGENTIC-CHAT] edit_xlsx HTTP error: %s %s', e.response.status_code, e.response.text[:200])
        return json.dumps({'error': f'Edit failed: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] edit_xlsx error: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})

    artifacts = result.get('artifacts', {})
    source_script_out = result.get('source_script')
    artifact_contents = {
        'xlsx_path': {
            'content': artifacts.get('content', ''),
            'extension': artifacts.get('extension', '.xlsx'),
            'encoding': artifacts.get('encoding', 'base64'),
            'source_script': source_script_out,
            'diffStat': result.get('diffStat'),
        },
    }
    return json.dumps({'artifacts': artifact_contents, 'errors': {}})


@tool
async def create_html(
    title: str,
    state: Annotated[AgenticChatState, InjectedState],
    content: str = '',
    style: str = 'default',
    feedback: str = '',
) -> str:
    """Create a fully styled, interactive HTML presentation (slide deck).

    Use this only when the user explicitly asks for an HTML, web-based, or interactive presentation.
    In corporate usage, "presentation", "slide deck", "pitch deck", and "briefing slides" default to
    PowerPoint — use create_pptx instead unless HTML, web, or interactive is explicitly requested.
    This tool produces a polished, self-contained HTML presentation with animations and transitions.

    The generated presentation will be automatically attached to your response. After calling
    this tool, write a natural response describing what was created — do NOT try to include
    the artifact yourself.

    Args:
        title: Title for the presentation.
        content: Your synthesized findings from search — the key facts, data, quotes, and structure you want in the slides. Include everything relevant you found. The tool also fetches full source text as supplementary reference, but YOUR synthesis drives the content. When regenerating after user feedback, include the user's exact correction verbatim.
        style: Design style preference (default, corporate-minimal, tech-forward, data-driven, magazine-editorial, executive-brief).
        feedback: REQUIRED when the user has asked for changes to a previously generated presentation. Copy the user's exact correction here verbatim. The subagent only sees this field and the content — it cannot read the conversation history, so if you leave this blank the subagent will repeat the same mistakes.
    """
    job_id = state.get('job_id')
    document_ids = state.get('document_ids') or []
    if document_ids:
        if job_id:
            await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': f'Reading {len(document_ids)} source document(s)...'}))
        try:
            raw_text = await _call_mcp_tool(
                'get_text',
                {
                    'userId': state['user_id'],
                    'documentIds': json.dumps(document_ids),
                },
                timeout=30,
            )
            _MAX_CHARS = 600_000
            if len(raw_text) <= _MAX_CHARS:
                content = f'{content}\n\nREFERENCE SOURCE DOCUMENTS (use to verify and supplement the above):\n{raw_text}'
                logger.info('[AGENTIC-CHAT] create_html: fetched full doc text for %d document(s) (%d chars)', len(document_ids), len(raw_text))
            else:
                logger.warning('[AGENTIC-CHAT] create_html: doc text too large (%d chars), using model content', len(raw_text))
        except Exception as exc:
            logger.warning('[AGENTIC-CHAT] create_html: get_text failed, using model content: %s', exc)

    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            logger.warning('Failed to resolve model ID %s, using as-is this call', model_id)
    external_model_id = _model_id_cache.get(model_id, model_id)

    payload = {
        'model_id': external_model_id,
        'user_id': state['user_id'],
        'chat_message_id': state.get('chat_message_id'),
        'user_group_id': state.get('user_group_id'),
        'content': content,
        'title': title,
        'style': style,
        'feedback': feedback,
        'job_id': state.get('job_id'),
    }
    if job_id:
        await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': 'Sending to presentation generation agent...'}))
    try:
        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f'{_CLAUDE_SERVICE_URL}/create-html',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            artifacts = result.get('artifacts', {})
            artifact_contents = {
                'html_path': {
                    'content': artifacts.get('content', ''),
                    'extension': artifacts.get('extension', '.html'),
                    'encoding': artifacts.get('encoding', 'utf-8'),
                },
            }
            return json.dumps({'artifacts': artifact_contents, 'errors': {}})
    except httpx.HTTPStatusError as e:
        logger.error('[AGENTIC-CHAT] create_html HTTP error: %s %s', e.response.status_code, e.response.text[:200])
        return json.dumps({'error': f'Generation failed: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] create_html error: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})


@tool
async def create_pptx(
    title: str,
    state: Annotated[AgenticChatState, InjectedState],
    content: str = '',
    use_template: bool = True,
) -> str:
    """Create a PowerPoint (.pptx) file — a real downloadable Office file, not HTML.

    Use this as the default for "presentation", "slide deck", "pitch deck", "briefing slides", and
    any mention of "PowerPoint", "pptx", "Office presentation", "downloadable slides".

    **use_template** controls whether to apply the organization's branded template:
    - True (default): uses the group's configured template for branded/corporate decks
    - False: creates a fresh creative deck from scratch (no template) — use when the user
      says "create a ppt" without mentioning branding, or asks for a custom/creative design

    Set use_template=True when the user mentions: branded, corporate, official, org template.
    Set use_template=False when the user just wants a presentation without specifying branding.

    Use create_html instead only when the user explicitly asks for an HTML, web-based, or interactive presentation.

    If the source material is a previously generated artifact in this conversation (e.g. "based on
    the cats document"), call get_artifact_text first to retrieve its full text, then pass that
    text as part of the content argument.

    The generated file will be automatically attached to your response. After calling this tool,
    write a natural response describing what was created — do NOT try to include the artifact yourself.

    Args:
        title: Title for the presentation.
        content: Your synthesized findings — the key facts, data, structure, and any branding
            instructions you want in the slides. Include everything relevant.
        use_template: Whether to use the organization's branded template (default True).
    """
    job_id = state.get('job_id')
    document_ids = state.get('document_ids') or []
    if document_ids:
        if job_id:
            await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': f'Reading {len(document_ids)} source document(s)...'}))
        try:
            raw_text = await _call_mcp_tool(
                'get_text',
                {
                    'userId': state['user_id'],
                    'documentIds': json.dumps(document_ids),
                },
                timeout=30,
            )
            _MAX_CHARS = 600_000
            if len(raw_text) <= _MAX_CHARS:
                content = f'{content}\n\nREFERENCE SOURCE DOCUMENTS (use to verify and supplement the above):\n{raw_text}'
                logger.info('[AGENTIC-CHAT] create_pptx: fetched full doc text for %d document(s) (%d chars)', len(document_ids), len(raw_text))
            else:
                logger.warning('[AGENTIC-CHAT] create_pptx: doc text too large (%d chars), using model content', len(raw_text))
        except Exception as exc:
            logger.warning('[AGENTIC-CHAT] create_pptx: get_text failed, using model content: %s', exc)

    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            logger.warning('Failed to resolve model ID %s, using as-is this call', model_id)
    external_model_id = _model_id_cache.get(model_id, model_id)

    payload = {
        'model_id': external_model_id,
        'internal_model_id': model_id,
        'user_id': state['user_id'],
        'chat_message_id': state.get('chat_message_id'),
        'user_group_id': state.get('user_group_id'),
        'content': content,
        'title': title,
        'use_template': use_template,
        'job_id': state.get('job_id'),
    }
    if job_id:
        await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': 'Sending to presentation generation agent...'}))
    try:
        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f'{_CLAUDE_SERVICE_URL}/create-pptx',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            artifacts = result.get('artifacts', {})
            source_script = result.get('source_script')
            artifact_contents = {
                'pptx_path': {
                    'content': artifacts.get('content', ''),
                    'extension': artifacts.get('extension', '.pptx'),
                    'encoding': artifacts.get('encoding', 'base64'),
                    'source_script': source_script,
                },
            }
            return json.dumps({'artifacts': artifact_contents, 'errors': {}})
    except httpx.HTTPStatusError as e:
        logger.error('[AGENTIC-CHAT] create_pptx HTTP error: %s %s', e.response.status_code, e.response.text[:200])
        return json.dumps({'error': f'Generation failed: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] create_pptx error: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})


@tool
async def edit_pptx(
    changes: str,
    state: Annotated[AgenticChatState, InjectedState],
    artifact_label: str = '',
) -> str:
    """Edit a PowerPoint (.pptx) file that was previously generated in this conversation.

    Use this when the user wants to modify an existing .pptx artifact — e.g. "add a slide about X",
    "change the title", "remove a slide", "update the content", "fix slide 5".

    Pass the artifact label in `artifact_label` to identify which .pptx to edit.

    The edited file will be automatically attached to your response. After calling this tool,
    write a natural response describing what was changed — do NOT try to include the artifact yourself.

    Args:
        changes: Exact description of what to change, verbatim from the user.
        artifact_label: Label of the previously generated .pptx artifact to edit.
    """
    job_id = state.get('job_id')
    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            logger.warning('Failed to resolve model ID %s, using as-is this call', model_id)
    external_model_id = _model_id_cache.get(model_id, model_id)

    if not artifact_label:
        return json.dumps({'error': 'artifact_label is required to edit a .pptx — provide the label of the presentation to edit.'})

    if job_id:
        await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': f'Retrieving source for "{artifact_label}"...'}))

    source_script = None
    try:
        chat_id = state.get('chat_id', '')
        async with httpx.AsyncClient(timeout=10) as client:
            src_resp = await client.post(
                f'{_NEXT_URL}/api/internal/artifact-source',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json={'chatId': chat_id, 'label': artifact_label},
            )
            src_resp.raise_for_status()
            source_script = src_resp.json().get('sourceScript')
    except Exception as exc:
        logger.warning('[AGENTIC-CHAT] edit_pptx: could not fetch source script for "%s": %s', artifact_label, exc)

    if not source_script:
        script_map = state.get('artifact_script_map') or {}
        entry = script_map.get(artifact_label) or {}
        source_script = entry.get('script')

    if not source_script:
        return json.dumps({'error': f'No editable source found for "{artifact_label}". Only presentations generated in this conversation can be edited.'})

    try:
        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f'{_CLAUDE_SERVICE_URL}/edit-pptx',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json={
                    'model_id': external_model_id,
                    'internal_model_id': model_id,
                    'user_id': state['user_id'],
                    'chat_message_id': state.get('chat_message_id'),
                    'user_group_id': state.get('user_group_id'),
                    'source_script': source_script,
                    'changes': changes,
                    'job_id': state.get('job_id'),
                },
            )
            resp.raise_for_status()
            result = resp.json()
            artifacts = result.get('artifacts', {})
            new_source_script = result.get('source_script', source_script)
            artifact_contents = {
                'pptx_path': {
                    'content': artifacts.get('content', ''),
                    'extension': artifacts.get('extension', '.pptx'),
                    'encoding': artifacts.get('encoding', 'base64'),
                    'source_script': new_source_script,
                    'diffStat': result.get('diffStat'),
                },
            }
            return json.dumps({'artifacts': artifact_contents})
    except httpx.HTTPStatusError as e:
        logger.error('[AGENTIC-CHAT] edit_pptx HTTP error: %s %s', e.response.status_code, e.response.text[:200])
        return json.dumps({'error': f'Edit failed: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] edit_pptx error: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})


@tool
async def create_mp4(
    title: str,
    state: Annotated[AgenticChatState, InjectedState],
    content: str = '',
    style: str = 'default',
    feedback: str = '',
) -> str:
    """Create an animated explainer video with text-to-speech narration.

    Use this when the user asks for a video, animated explainer, or visual walkthrough.
    This tool sends your content to a dedicated subagent that produces VideoSlide JSON
    rendered by Remotion with Polly TTS narration.

    The generated video will be automatically attached to your response. After calling
    this tool, write a natural response describing what was created — do NOT try to include
    the artifact yourself.

    Args:
        title: Title for the video.
        content: Your synthesized findings from search — the key facts, data, quotes, and structure you want in the video. Include everything relevant you found. The tool also fetches full source text as supplementary reference, but YOUR synthesis drives the content. When regenerating after user feedback, include the user's exact correction verbatim.
        style: Design style preference (default, corporate-minimal, tech-forward, data-driven, magazine-editorial, executive-brief).
        feedback: REQUIRED when the user has asked for changes to a previously generated video. Copy the user's exact correction here verbatim. The subagent only sees this field and the content — it cannot read the conversation history, so if you leave this blank the subagent will repeat the same mistakes.
    """
    job_id = state.get('job_id')
    document_ids = state.get('document_ids') or []
    if document_ids:
        if job_id:
            await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': f'Reading {len(document_ids)} source document(s)...'}))
        try:
            raw_text = await _call_mcp_tool(
                'get_text',
                {
                    'userId': state['user_id'],
                    'documentIds': json.dumps(document_ids),
                },
                timeout=30,
            )
            _MAX_CHARS = 600_000
            if len(raw_text) <= _MAX_CHARS:
                content = f'{content}\n\nREFERENCE SOURCE DOCUMENTS (use to verify and supplement the above):\n{raw_text}'
                logger.info('[AGENTIC-CHAT] create_mp4: fetched full doc text for %d document(s) (%d chars)', len(document_ids), len(raw_text))
            else:
                logger.warning('[AGENTIC-CHAT] create_mp4: doc text too large (%d chars), using model content', len(raw_text))
        except Exception as exc:
            logger.warning('[AGENTIC-CHAT] create_mp4: get_text failed, using model content: %s', exc)

    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            logger.warning('Failed to resolve model ID %s, using as-is this call', model_id)
    external_model_id = _model_id_cache.get(model_id, model_id)

    payload = {
        'model_id': external_model_id,
        'user_id': state['user_id'],
        'chat_message_id': state.get('chat_message_id'),
        'user_group_id': state.get('user_group_id'),
        'content': content,
        'title': title,
        'style': style,
        'feedback': feedback,
        'job_id': state.get('job_id'),
    }
    if job_id:
        await _update_job_progress(job_id, json.dumps({'type': 'subagent_progress', 'label': 'Sending to video generation agent...'}))
    try:
        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f'{_CLAUDE_SERVICE_URL}/create-mp4',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json=payload,
            )
            resp.raise_for_status()
            result = resp.json()
            artifacts = result.get('artifacts', {})
            artifact_contents = {
                'mp4_path': {
                    'content': artifacts.get('content', ''),
                    'extension': artifacts.get('extension', '.mp4'),
                    'encoding': artifacts.get('encoding', 'utf-8'),
                },
            }
            return json.dumps({'artifacts': artifact_contents, 'errors': {}})
    except httpx.HTTPStatusError as e:
        logger.error('[AGENTIC-CHAT] create_mp4 HTTP error: %s %s', e.response.status_code, e.response.text[:200])
        return json.dumps({'error': f'Generation failed: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] create_mp4 error: %s', e, exc_info=True)
        return json.dumps({'error': str(e)})


@tool
def get_current_date() -> str:
    """Return today's date, current fiscal year, fiscal quarter, and days remaining in the
    fiscal year (Oct 1 – Sep 30). Use this whenever the question involves current date,
    deadlines, time remaining, or comparisons against today."""
    today = date.today()
    # US federal fiscal year: Oct 1 – Sep 30
    fy_start_year = today.year if today.month >= 10 else today.year - 1
    fy_end = date(fy_start_year + 1, 9, 30)
    fy = fy_start_year + 1
    month = today.month
    if month >= 10:
        fq = 1
    elif month >= 7:
        fq = 4
    elif month >= 4:
        fq = 3
    else:
        fq = 2
    days_remaining = (fy_end - today).days
    return json.dumps({
        'today': today.isoformat(),
        'day_of_week': today.strftime('%A'),
        'fiscal_year': f'FY{fy}',
        'fiscal_quarter': f'Q{fq}',
        'fiscal_year_end': fy_end.isoformat(),
        'days_remaining_in_fy': days_remaining,
    })


@tool
def get_artifact_instructions() -> str:
    """Return the formatting rules for producing artifacts (documents, code, spreadsheets,
    presentations, videos, and diagrams). Call this before generating any artifact so you
    know the exact syntax, file extension choices, and quality rules."""
    return _ARTIFACT_INSTRUCTIONS


@tool
def get_app_context() -> str:
    """Return background information about PALM (the application the user is currently using)
    and its features. Call this ONLY when the user asks what you can do, how the app works, or
    about any PALM feature. Do NOT call this for artifact generation tasks."""
    return _APP_CONTEXT


@tool
async def skill_repo_list() -> str:
    """List all available skill repositories and their descriptions.
    Call this first to discover which repos are available and pick the right one
    for the user's question. Each repo has a repo_id you'll pass to other skill_repo tools."""
    return await _call_mcp_tool('skill_repo_list', {}, timeout=10)


@tool
async def skill_repo_list_files(repo_id: str, path: str = '') -> str:
    """List markdown files in a skill repository.
    Use this to explore the repo structure when deciding which file to read."""
    args: dict[str, str] = {'repo_id': repo_id}
    if path:
        args['path'] = path
    return await _call_mcp_tool('skill_repo_list_files', args, timeout=10)


@tool
async def skill_repo_read_file(repo_id: str, path: str) -> str:
    """Read a markdown file from a skill repository.
    Use this to look up specific files for full content."""
    return await _call_mcp_tool('skill_repo_read_file', {'repo_id': repo_id, 'path': path}, timeout=10)


@tool
async def skill_repo_search(repo_id: str, query: str, path: str = '') -> str:
    """Search across all markdown files in a skill repository using keyword/regex.
    Returns matching lines with context. Use this for factual lookups."""
    args: dict[str, str] = {'repo_id': repo_id, 'query': query}
    if path:
        args['path'] = path
    return await _call_mcp_tool('skill_repo_search', args, timeout=30)


@tool
async def skill_repo_list_commands(repo_id: str) -> str:
    """List the available slash commands in a skill repository.
    Call this when the user asks to draft, generate, outline, or produce an artifact."""
    return await _call_mcp_tool('skill_repo_list_commands', {'repo_id': repo_id}, timeout=10)


@tool
async def skill_repo_load_command(repo_id: str, command: str) -> str:
    """Load the full methodology/instructions for a skill repo command WITHOUT executing it.

    Call this BEFORE skill_repo_run_command to read the command's methodology. The
    methodology will tell you what context to gather from the user (e.g. questions to ask,
    options to present). Collect that context in the conversation, then pass it all as
    user_input to skill_repo_run_command.

    Args:
        repo_id: The repo ID (from skill_repo_list)
        command: Command name (from skill_repo_list_commands)
    """
    _last_loaded_command['repo_id'] = repo_id
    _last_loaded_command['command'] = command
    raw = await _call_mcp_tool('skill_repo_run_command', {'repo_id': repo_id, 'command': command}, timeout=60)
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw
    instructions = payload.get('instructions', '')
    return (
        f'# Command: /{command}\n\n'
        f'{instructions}\n\n'
        '---\n'
        'READ the methodology above. Identify any context-gathering phases (questions to ask '
        'the user, options to present, information to collect). IMPORTANT: The skill repo '
        'contains source files that the subagent will read automatically when it runs. Do NOT '
        'ask the user for information that the repo already provides — assume any factual or '
        'reference data the methodology needs is in the repo. Only ask questions that require '
        'the user\'s JUDGMENT or PREFERENCE (choices between options, detail level, scope, '
        'priorities, or context specific to this particular request that would not be in any '
        'repo file). Once you have the user\'s preferences, call skill_repo_run_command with '
        'ONLY the user_input parameter containing ALL context.'
    )


@tool
async def skill_repo_run_command(
    state: Annotated[AgenticChatState, InjectedState],
    user_input: str = '',
    repo_id: str = '',
    command: str = '',
) -> str:
    """Execute a skill repo command using a dedicated subagent that produces the final artifact.

    IMPORTANT: Call skill_repo_load_command FIRST to read the methodology and collect any
    required context from the user. Only call this tool once you have gathered all the
    context the methodology requires.

    This tool sends the methodology, source files, attached documents, and your collected
    user_input to a dedicated expert agent. The result is the finished artifact text.

    After calling this tool, present the output to the user as an artifact (call
    get_artifact_instructions for formatting rules).

    Args:
        user_input: ALL collected context from the user (answers to methodology questions,
                    preferences, requirements, etc.) — pass everything gathered in conversation
        repo_id: Optional — auto-filled from skill_repo_load_command if omitted
        command: Optional — auto-filled from skill_repo_load_command if omitted
    """
    actual_repo_id = repo_id or _last_loaded_command.get('repo_id', '')
    actual_command = command or _last_loaded_command.get('command', '')
    logger.info('[AGENTIC-CHAT] skill_repo_run_command: repo_id=%r command=%r stored=%r',
                actual_repo_id, actual_command, _last_loaded_command)
    if not actual_repo_id or not actual_command:
        return json.dumps({'error': 'No command loaded. Call skill_repo_load_command first.'})

    args: dict[str, str] = {'repo_id': actual_repo_id, 'command': actual_command}
    if user_input:
        args['user_input'] = user_input

    # Load methodology + bundled sources from MCP
    raw = await _call_mcp_tool('skill_repo_run_command', args, timeout=60)
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw

    instructions = payload.get('instructions', '')
    sources = payload.get('sources', '')

    # Fetch attached document content
    document_content = ''
    document_ids = state.get('document_ids') or []
    if document_ids:
        try:
            document_content = await _call_mcp_tool(
                'get_text',
                {'userId': state['user_id'], 'documentIds': json.dumps(document_ids)},
                timeout=30,
            )
            logger.info('[AGENTIC-CHAT] skill_repo_run_command: get_text returned %d chars, preview=%s',
                        len(document_content), document_content[:100])
            _MAX_CHARS = 600_000
            if len(document_content) > _MAX_CHARS:
                document_content = document_content[:_MAX_CHARS]
        except Exception as e:
            logger.warning('[AGENTIC-CHAT] skill_repo_run_command: get_text failed: %s', e)

    # Resolve model ID
    model_id = state['model_id']
    if model_id not in _model_id_cache:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resolve_resp = await client.post(
                    f'{_NEXT_URL}/api/internal/resolve-model',
                    headers={'Authorization': f'Bearer {_API_KEY}'},
                    json={'modelId': model_id},
                )
                resolve_resp.raise_for_status()
                _model_id_cache[model_id] = resolve_resp.json().get('externalId', model_id)
        except Exception:
            pass
    external_model_id = _model_id_cache.get(model_id, model_id)

    # Send to dedicated subagent
    try:
        async with httpx.AsyncClient(timeout=1800) as client:
            resp = await client.post(
                f'{_CLAUDE_SERVICE_URL}/run-skill-command',
                headers={'Authorization': f'Bearer {_API_KEY}'},
                json={
                    'model_id': external_model_id,
                    'user_id': state['user_id'],
                    'chat_message_id': state.get('chat_message_id'),
                    'user_group_id': state.get('user_group_id'),
                    'command': actual_command,
                    'instructions': instructions,
                    'sources': '',
                    'document_content': document_content,
                    'user_input': user_input,
                    'job_id': state.get('job_id'),
                    'repo_id': actual_repo_id,
                },
            )
            resp.raise_for_status()
            result = resp.json()
            output = result.get('output', '')
            if output:
                return (
                    'SKILL COMMAND COMPLETE. The text below is the FINISHED artifact produced by a '
                    'dedicated expert agent. You MUST present it VERBATIM to the user inside an '
                    'artifact wrapper (````artifact(".md","RFI Draft Response")\n...\n````). '
                    'Do NOT summarize, rewrite, or add a strategy overview. '
                    'Do NOT ask the user if they want you to proceed. '
                    'The artifact is ALREADY written — just wrap and deliver it.\n\n'
                    + output
                )
            return json.dumps({'error': 'Agent produced no output'})
    except httpx.HTTPStatusError as e:
        logger.error('[AGENTIC-CHAT] skill_repo_run_command HTTP error: %s %s', e.response.status_code, e.response.text[:200])
        return json.dumps({'error': f'Skill command failed: {e.response.status_code}'})
    except Exception as e:
        logger.error('[AGENTIC-CHAT] skill_repo_run_command error: %s', e)
        return json.dumps({'error': str(e)})


ALL_TOOLS = [
    get_current_date, get_federal_holidays, get_business_days,
    get_artifact_instructions, get_app_context,
    get_library_documents, get_document_list, get_text, search, cypher_query, analyze_spreadsheet_data,
    search_conversations, find_artifacts, get_recent_conversations, get_conversation_messages,
    get_conversation_artifact,
    create_docx, create_xlsx, edit_docx, edit_xlsx, create_html, create_pptx, edit_pptx, create_mp4,
    edit_artifact,
    skill_repo_list, skill_repo_list_files, skill_repo_read_file,
    skill_repo_search, skill_repo_list_commands, skill_repo_load_command,
    skill_repo_run_command,
]


def _tools_for_state(state: AgenticChatState) -> list:
    tools = [
        get_current_date, get_federal_holidays, get_business_days,
        get_artifact_instructions, get_app_context,
        get_library_documents, create_docx, create_xlsx, create_html, create_pptx, create_mp4,
    ]
    if state.get('has_skill_repos'):
        tools += [
            skill_repo_list, skill_repo_list_files, skill_repo_read_file,
            skill_repo_search, skill_repo_list_commands, skill_repo_load_command,
            skill_repo_run_command,
        ]
    script_map = state.get('artifact_script_map') or {}
    if script_map:
        tools.append(get_artifact_text)
    has_docx = any(e.get('ext') == '.docx' for e in script_map.values())
    if state.get('document_ids') or has_docx:
        tools.append(edit_docx)
    if any(e.get('ext') == '.xlsx' for e in script_map.values()) or any(
        d.get('filename', '').lower().endswith(('.xlsx', '.csv'))
        for d in (state.get('injected_document_list') or [])
    ):
        tools.append(edit_xlsx)
    if any(e.get('ext') == '.pptx' for e in script_map.values()):
        tools.append(edit_pptx)
    if state.get('inline_artifact_labels'):
        tools.append(edit_artifact)
    if state.get('document_ids'):
        tools += [get_text, search]
        structured_docs: list[dict] = state.get('structured_docs') or []
        # Only offer get_document_list when at least one structured doc is missing its schema
        needs_schema_fetch = any(not d.get('dataProfile') for d in structured_docs)
        if needs_schema_fetch:
            tools.append(get_document_list)
        if structured_docs:
            tools.append(analyze_spreadsheet_data)
        if state.get('use_graph'):
            tools.append(cypher_query)
    if state.get('memory_enabled'):
        tools += [
            search_conversations,
            find_artifacts,
            get_recent_conversations,
            get_conversation_messages,
            get_conversation_artifact,
        ]
    return tools
