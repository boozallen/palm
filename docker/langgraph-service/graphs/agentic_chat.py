import json
import logging
import uuid

from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode

from langgraph.config import get_stream_writer
from inference import chat_completion_with_tools, stream_chat_completion_with_tools
from graphs.graph_mcp import _update_job_progress, mcp_session_context
from graphs.prompts import _build_system_message, _messages_to_api_format
from graphs.state import AgenticChatState
from graphs.tools import ALL_TOOLS, _tools_for_state

logger = logging.getLogger(__name__)


def _dedupe_against_existing(
    new: list[dict[str, Any]],
    existing: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    existing_ids: set[tuple[str, str]] = set()
    id_keys = ('embeddingId', 'graphEntityId', 'graphConceptId')
    for c in existing:
        for key in id_keys:
            value = c.get(key)
            if value:
                existing_ids.add((c.get('contextType', 'DOCUMENT_LIBRARY'), value))

    result: list[dict[str, Any]] = []
    seen_in_batch: set[tuple[str, str]] = set()
    for c in new:
        ident: tuple[str, str] | None = None
        for key in id_keys:
            value = c.get(key)
            if value:
                ident = (c.get('contextType', 'DOCUMENT_LIBRARY'), value)
                break
        if ident is None:
            result.append(c)
            continue
        if ident in existing_ids or ident in seen_in_batch:
            continue
        seen_in_batch.add(ident)
        result.append(c)
    return result


# ---------------------------------------------------------------------------
# Write-time citation handles
# ---------------------------------------------------------------------------

def _assign_node_handle(node_id: str, handle_map: dict[str, Any]) -> str:
    """Return the existing `E#` handle for this graph node id, or mint the next one (turn-global).

    Label-agnostic: the handle maps to a node UUID regardless of label (entity, concept, chunk,
    document), so any graph tool's node results cite through the same `E#` mechanism.
    """
    for h, v in handle_map.items():
        if h.startswith('E') and v == node_id:
            return h
    idx = 1 + max(
        (int(h[1:]) for h in handle_map if h.startswith('E') and h[1:].isdigit()),
        default=0,
    )
    handle = f'E{idx}'
    handle_map[handle] = node_id
    return handle


def _assign_relationship_handle(src: str, rel_type: str, tgt: str, handle_map: dict[str, Any]) -> str:
    """Return the existing `R#` handle for this (src, relType, tgt) triple, or mint the next one."""
    for h, v in handle_map.items():
        if (
            h.startswith('R')
            and isinstance(v, dict)
            and v.get('src') == src
            and v.get('relType') == rel_type
            and v.get('tgt') == tgt
        ):
            return h
    idx = 1 + max(
        (int(h[1:]) for h in handle_map if h.startswith('R') and h[1:].isdigit()),
        default=0,
    )
    handle = f'R{idx}'
    handle_map[handle] = {'src': src, 'relType': rel_type, 'tgt': tgt}
    return handle


def _assign_query_handle(result_index: int, handle_map: dict[str, Any]) -> str:
    """Return the existing `Q#` handle for this graph_search_results index, or mint the next one.

    A `Q#` is a query/retrieval-level citation: it maps to a position in `graph_search_results`,
    so the worker can union that whole retrieval's node/edge mappings into the evidence graph even
    when the rows were capped out of the agent's view (the agent cites the result's shape, not rows).
    """
    for h, v in handle_map.items():
        if h.startswith('Q') and v == result_index:
            return h
    idx = 1 + max(
        (int(h[1:]) for h in handle_map if h.startswith('Q') and h[1:].isdigit()),
        default=0,
    )
    handle = f'Q{idx}'
    handle_map[handle] = result_index
    return handle


def _assign_conversation_handle(
    message_id: str,
    chat_id: str,
    handle_map: dict[str, Any],
) -> str:
    """Return the existing `C#` handle for a message, or mint the next one."""
    for h, v in handle_map.items():
        if h.startswith('C') and isinstance(v, dict) and v.get('messageId') == message_id:
            return h
    idx = 1 + max(
        (int(h[1:]) for h in handle_map if h.startswith('C') and h[1:].isdigit()),
        default=0,
    )
    handle = f'C{idx}'
    handle_map[handle] = {'messageId': message_id, 'chatId': chat_id}
    return handle


def _annotate_cypher_rows(
    rows: list[dict[str, Any]],
    node_mapping: list[dict[str, Any]],
    edge_mapping: list[dict[str, Any]],
    handle_map: dict[str, Any],
) -> None:
    """Append `[[E#]]` handles next to mapped entity cells and `[[R#]]` next to the
    relationship-type cell, in place, so the agent cites the handle alongside the name it
    naturally writes. Both endpoint nodes AND the edge get handles for every relationship row."""
    nodes_by_row: dict[int, list[dict[str, Any]]] = {}
    for entry in node_mapping:
        if isinstance(entry, dict) and isinstance(entry.get('rowIndex'), int):
            nodes_by_row.setdefault(entry['rowIndex'], []).append(entry)
    edges_by_row: dict[int, list[dict[str, Any]]] = {}
    for entry in edge_mapping:
        if isinstance(entry, dict) and isinstance(entry.get('rowIndex'), int):
            edges_by_row.setdefault(entry['rowIndex'], []).append(entry)

    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        for entry in nodes_by_row.get(i, []):
            col_key = entry.get('colKey')
            entity_ids = [e for e in (entry.get('entityIds') or []) if isinstance(e, str) and e]
            handles = [f'[[{_assign_node_handle(eid, handle_map)}]]' for eid in entity_ids]
            if not handles:
                continue
            if col_key and isinstance(row.get(col_key), str):
                to_add = [h for h in handles if h not in row[col_key]]
                if to_add:
                    row[col_key] = f"{row[col_key]} {' '.join(to_add)}"
            else:
                existing = row.get('_entityHandles')
                joined = ' '.join(handles)
                row['_entityHandles'] = f"{existing} {joined}".strip() if existing else joined
        for entry in edges_by_row.get(i, []):
            src, rel_type, tgt = entry.get('src'), entry.get('relType'), entry.get('tgt')
            if not (isinstance(src, str) and isinstance(rel_type, str) and isinstance(tgt, str)):
                continue
            r_handle = f'[[{_assign_relationship_handle(src, rel_type, tgt, handle_map)}]]'
            rel_col = next(
                (k for k, v in row.items() if isinstance(v, str) and v == rel_type and not k.startswith('_')),
                None,
            )
            if rel_col:
                if r_handle not in row[rel_col]:
                    row[rel_col] = f"{row[rel_col]} {r_handle}"
            else:
                existing = row.get('_relationshipHandles')
                pair = f"{rel_type} {r_handle}"
                row['_relationshipHandles'] = f"{existing}, {pair}" if existing else pair


def _dispatch_search(state: AgenticChatState, last_msg: ToolMessage, handle_map: dict[str, Any]) -> dict[str, Any]:
    try:
        payload = json.loads(last_msg.content)
    except (json.JSONDecodeError, TypeError):
        return {}

    if not isinstance(payload, dict) or 'error' in payload:
        return {}

    new_citations: list[dict[str, Any]] = []

    for chunk in payload.get('chunks', []) or []:
        new_citations.append({
            'contextType': 'DOCUMENT_LIBRARY',
            'documentId': chunk.get('documentId'),
            'embeddingId': chunk.get('embeddingId'),
            'sourceLabel': chunk.get('sourceLabel'),
            'citation': chunk.get('citation'),
        })

    for entity in payload.get('entities', []) or []:
        new_citations.append({
            'contextType': 'GRAPH_ENTITY',
            'graphEntityId': entity.get('id'),
            'sourceLabel': entity.get('name'),
            'citation': entity.get('description') or entity.get('name'),
            'description': entity.get('description'),
            'aliases': entity.get('aliases', []),
        })

    for concept in payload.get('concepts', []) or []:
        new_citations.append({
            'contextType': 'GRAPH_CONCEPT',
            'graphConceptId': concept.get('id'),
            'sourceLabel': concept.get('name'),
            'citation': concept.get('description') or concept.get('name'),
            'description': concept.get('description'),
            'category': concept.get('category'),
        })

    deduped = _dedupe_against_existing(new_citations, state['citations'])

    update: dict[str, Any] = {'citations': state['citations'] + deduped}
    update['_dedupe_counts'] = {
        'chunks': len([c for c in deduped if c['contextType'] == 'DOCUMENT_LIBRARY']),
        'entities': len([c for c in deduped if c['contextType'] == 'GRAPH_ENTITY']),
        'concepts': len([c for c in deduped if c['contextType'] == 'GRAPH_CONCEPT']),
    }
    update['_deduped_items'] = deduped

    # Capture the graph-render payload (entity/concept anchors) so the worker can
    # assemble the canvas at end-of-turn, then trim it out of the agent-visible
    # ToolMessage — mirrors _dispatch_cypher. The agent keeps chunks/entities/
    # concepts for reasoning + citations; only the heavy uiPayload is stripped.
    ui_payload = payload.get('uiPayload')
    if isinstance(ui_payload, dict) and ui_payload:
        lean_payload = {k: v for k, v in payload.items() if k != 'uiPayload'}

        # Write-time citation: tag each entity/concept the agent reads with its [[E#]] handle so
        # it can cite the exact graph node behind a claim. Only when the flag is on, so flag-off
        # leaves the agent-visible payload byte-identical to before.
        if state.get('cite_evidence'):
            for entity in lean_payload.get('entities', []) or []:
                eid = entity.get('id') if isinstance(entity, dict) else None
                if isinstance(eid, str) and eid:
                    entity['handle'] = f'[[{_assign_node_handle(eid, handle_map)}]]'
            for concept in lean_payload.get('concepts', []) or []:
                cid = concept.get('id') if isinstance(concept, dict) else None
                if isinstance(cid, str) and cid:
                    concept['handle'] = f'[[{_assign_node_handle(cid, handle_map)}]]'
            # Query-level handle for the whole search retrieval (same index-before-append rule as
            # _dispatch_cypher: graph_search_results is appended below, so the current length is
            # the position this entry will occupy).
            result_index = len(state.get('graph_search_results') or [])
            q_handle = _assign_query_handle(result_index, handle_map)
            lean_payload['queryHandle'] = f'[[{q_handle}]]'
            update['handle_map'] = handle_map

        trimmed = ToolMessage(
            content=json.dumps(lean_payload),
            id=last_msg.id,                       # SAME id -> add_messages REPLACES in place
            tool_call_id=last_msg.tool_call_id,   # MUST preserve (provider pairs it with the AI tool_call)
            name=last_msg.name,                   # preserve for downstream name checks
        )
        update['messages'] = [trimmed]
        update['graph_search_results'] = state.get('graph_search_results', []) + [ui_payload]

    return update


def _dispatch_memory(
    state: AgenticChatState,
    last_msg: ToolMessage,
    handle_map: dict[str, Any],
) -> dict[str, Any]:
    try:
        payload = json.loads(last_msg.content)
    except (json.JSONDecodeError, TypeError):
        return {}

    if not isinstance(payload, dict) or 'error' in payload:
        return {}

    if last_msg.name in {'search_conversations', 'find_artifacts'}:
        for item in payload.get('results', []) or []:
            if not isinstance(item, dict):
                continue
            message_id = item.get('messageId')
            chat_id = item.get('chatId')
            if isinstance(message_id, str) and message_id and isinstance(chat_id, str) and chat_id:
                item['handle'] = f'[[{_assign_conversation_handle(message_id, chat_id, handle_map)}]]'
    elif last_msg.name == 'get_conversation_messages':
        chat_id = payload.get('chatId')
        if isinstance(chat_id, str) and chat_id:
            for item in payload.get('messages', []) or []:
                if not isinstance(item, dict):
                    continue
                message_id = item.get('messageId')
                if isinstance(message_id, str) and message_id:
                    item['handle'] = f'[[{_assign_conversation_handle(message_id, chat_id, handle_map)}]]'
    elif last_msg.name == 'get_recent_conversations':
        for item in payload.get('conversations', []) or []:
            if not isinstance(item, dict):
                continue
            last_message = item.get('lastMessage')
            message_id = last_message.get('messageId') if isinstance(last_message, dict) else None
            chat_id = item.get('chatId')
            if isinstance(message_id, str) and message_id and isinstance(chat_id, str) and chat_id:
                last_message['handle'] = f'[[{_assign_conversation_handle(message_id, chat_id, handle_map)}]]'
    elif last_msg.name == 'get_conversation_artifact':
        message_id = payload.get('messageId')
        chat_id = payload.get('chatId')
        if isinstance(message_id, str) and message_id and isinstance(chat_id, str) and chat_id:
            payload['handle'] = f'[[{_assign_conversation_handle(message_id, chat_id, handle_map)}]]'

    trimmed = ToolMessage(
        content=json.dumps(payload),
        id=last_msg.id,
        tool_call_id=last_msg.tool_call_id,
        name=last_msg.name,
    )
    return {'messages': [trimmed], 'handle_map': handle_map}


def _dispatch_cypher(state: AgenticChatState, last_msg: ToolMessage, handle_map: dict[str, Any]) -> dict[str, Any]:
    """Pull the structural cypher payload into state and trim the ToolMessage to the
    lean agent view. The heavy structural payload (rows + _nodeId_ + nodeMapping)
    accumulates in `graph_search_results`; the graphData is built once at
    end-of-turn in the worker, never here.
    """
    try:
        payload = json.loads(last_msg.content)
    except (json.JSONDecodeError, TypeError):
        return {}

    # MCP/tool error or unexpected shape — leave the ToolMessage intact so the agent
    # sees the error and can react. Nothing structural to collect.
    if not isinstance(payload, dict) or 'agentView' not in payload:
        return {}

    agent_view = payload['agentView']
    ui_payload = payload.get('uiPayload')

    # Write-time citation: annotate the agent-visible rows with [[E#]]/[[R#]] handles so the
    # agent cites the exact nodes + edges behind a claim. Only when the flag is on (flag-off
    # leaves the agent view byte-identical). Oversized results omit rows from the agent view —
    # those rows can't be cited, which is acceptable (uncited -> not evidence).
    cite_on = bool(state.get('cite_evidence'))
    if cite_on and isinstance(ui_payload, dict) and ui_payload:
        rows = agent_view.get('rows') if isinstance(agent_view, dict) else None
        if isinstance(rows, list) and rows:
            _annotate_cypher_rows(
                rows,
                ui_payload.get('nodeMapping') or [],
                ui_payload.get('edgeMapping') or [],
                handle_map,
            )
        # Query-level handle: tag the whole retrieval so the agent can cite the entire result
        # set as evidence WITHOUT reading its rows (works on the capped path where rows are
        # omitted). `result_index` is computed BEFORE the append below, so it equals the
        # position this entry will take in graph_search_results (the worker indexes the SAME
        # ordered list). Never reorder/filter graph_search_results or this alignment breaks.
        result_index = len(state.get('graph_search_results') or [])
        q_handle = _assign_query_handle(result_index, handle_map)
        if isinstance(agent_view, dict):
            agent_view['queryHandle'] = f'[[{q_handle}]]'

    # Replace the heavy tool result IN PLACE (SAME id) with the lean (now handle-annotated)
    # agent view, so the structural payload never bloats the agent's context window. A
    # different/omitted id would APPEND a duplicate instead of replacing.
    trimmed = ToolMessage(
        content=json.dumps(agent_view),
        id=last_msg.id,                       # SAME id -> add_messages REPLACES in place
        tool_call_id=last_msg.tool_call_id,   # MUST preserve (provider pairs it with the AI tool_call)
        name=last_msg.name,                   # preserve for downstream name checks
    )
    update: dict[str, Any] = {'messages': [trimmed]}
    if cite_on:
        update['handle_map'] = handle_map

    if isinstance(ui_payload, dict) and ui_payload:
        update['graph_search_results'] = state.get('graph_search_results', []) + [ui_payload]
    return update


async def _log_and_progress(job_id: str | None, msg: str, *, log_msg: str | None = None) -> None:
    logger.info('[AGENTIC-CHAT] %s', log_msg or msg)
    await _update_job_progress(job_id, msg)


def _tool_event(tool_name: str, label: str | None = None) -> str:
    payload: dict[str, str] = {'type': 'tool_call', 'toolName': tool_name}
    if label:
        payload['label'] = label
    return json.dumps(payload)


_SIMPLE_TOOL_LABELS: dict[str, str] = {
    'get_library_documents': 'Checking document library...',
    'get_current_date': 'Getting current date...',
    'get_federal_holidays': 'Looking up federal holidays...',
    'get_business_days': 'Calculating business days...',
    'get_artifact_instructions': 'Loading instructions...',
    'get_app_context': 'Loading app info...',
    'get_document_list': 'Loading document schema...',
    'get_text': 'Reading document text...',
    'get_recent_conversations': 'Reviewing recent conversations...',
    'get_conversation_messages': 'Reading a prior conversation...',
    'find_artifacts': 'Finding artifacts...',
    'get_conversation_artifact': 'Reading a prior artifact...',
    'skill_repo_list': 'Discovering skill repos...',
    'skill_repo_list_files': 'Listing repo files...',
    'skill_repo_list_commands': 'Loading available commands...',
}

_ARTIFACT_OUTPUT_TYPES: dict[str, tuple[str, str, str]] = {
    'create_docx': ('document', 'Generating document', 'title'),
    'create_xlsx': ('spreadsheet', 'Generating spreadsheet', 'title'),
    'create_html': ('presentation', 'Generating presentation', 'title'),
    'create_pptx': ('presentation', 'Generating PowerPoint', 'title'),
    'create_mp4': ('video', 'Generating video', 'title'),
    'edit_docx': ('document', 'Editing document', 'artifact_label'),
    'edit_xlsx': ('spreadsheet', 'Editing spreadsheet', 'artifact_label'),
    'edit_pptx': ('presentation', 'Editing PowerPoint', 'title'),
}

_ARTIFACT_TOOL_NAMES: set[str] = set(_ARTIFACT_OUTPUT_TYPES.keys())


def _used_tool_names(messages: list) -> set[str]:
    """Every tool name actually invoked so far, across all turns in this job."""
    used: set[str] = set()
    for m in messages:
        if isinstance(m, AIMessage) and m.tool_calls:
            for tc in m.tool_calls:
                name = tc.get('name')
                if name:
                    used.add(name)
    return used


async def _emit_tool_progress(job_id: str | None, tool_name: str, tool_input: dict[str, Any]) -> None:
    if not job_id:
        return
    if tool_name in _SIMPLE_TOOL_LABELS:
        await _update_job_progress(job_id, _tool_event(tool_name, _SIMPLE_TOOL_LABELS[tool_name]))
    elif tool_name in _ARTIFACT_OUTPUT_TYPES:
        output_type, verb, title_key = _ARTIFACT_OUTPUT_TYPES[tool_name]
        title_display = tool_input.get(title_key, '')
        event_label = f'{verb}: {title_display}' if title_display else f'{verb}...'
        event_payload: dict[str, Any] = {
            'type': 'tool_call',
            'toolName': tool_name,
            'label': event_label,
            'args': {'output_type': output_type, 'title': str(title_display)[:100] if title_display else ''},
        }
        style = tool_input.get('style')
        if style and style != 'NOT SET':
            event_payload['args']['style'] = style
        await _update_job_progress(job_id, json.dumps(event_payload))
    elif tool_name == 'search':
        await _update_job_progress(job_id, _tool_event(tool_name, tool_input.get('query', '')))
    elif tool_name == 'search_conversations':
        await _update_job_progress(job_id, _tool_event(tool_name, tool_input.get('query', '') or 'Searching prior conversations...'))
    elif tool_name == 'cypher_query':
        await _update_job_progress(job_id, _tool_event(tool_name, tool_input.get('sub_question', '') or None))
    elif tool_name == 'analyze_spreadsheet_data':
        question = str(tool_input.get('question', ''))[:80]
        analyze_label = f'Analyzing: {question}' if question else 'Analyzing data...'
        analyze_event: dict[str, Any] = {
            'type': 'tool_call',
            'toolName': tool_name,
            'label': analyze_label,
            'args': {'filename': tool_input.get('filename', ''), 'question': question},
        }
        await _update_job_progress(job_id, json.dumps(analyze_event))
    elif tool_name == 'skill_repo_search':
        await _update_job_progress(job_id, _tool_event(tool_name, str(tool_input.get('query', ''))[:60]))
    elif tool_name == 'skill_repo_read_file':
        await _update_job_progress(job_id, _tool_event(tool_name, tool_input.get('path', '')))
    elif tool_name == 'skill_repo_load_command':
        cmd = tool_input.get('command', '')
        await _update_job_progress(job_id, _tool_event(tool_name, f'Loading /{cmd} methodology...'))
    elif tool_name == 'skill_repo_run_command':
        cmd = tool_input.get('command', '')
        run_cmd_event: dict[str, Any] = {
            'type': 'tool_call',
            'toolName': tool_name,
            'label': f'Running /{cmd} with dedicated agent...',
            'args': {'command': cmd, 'title': str(tool_input.get('title', ''))[:100]},
        }
        await _update_job_progress(job_id, json.dumps(run_cmd_event))


# ---------------------------------------------------------------------------
# Tool catalog — lightweight names + descriptions for the planner call
# ---------------------------------------------------------------------------

_TOOL_CATALOG: dict[str, str] = {
    'get_current_date': "Today's date, fiscal year, and quarter",
    'get_federal_holidays': 'US federal holidays for a given year',
    'get_business_days': 'Calculate business days between two dates',
    'search': 'Search uploaded documents for relevant passages',
    'get_text': 'Get full text of all uploaded documents',
    'get_library_documents': "Browse all documents in user's library",
    'get_document_list': 'Get document metadata and column schemas for spreadsheets',
    'analyze_spreadsheet_data': 'Analyze Excel/CSV data with Python pandas',
    'cypher_query': 'Query the knowledge graph with natural language',
    'create_docx': 'Create a Word document',
    'create_xlsx': 'Create an Excel spreadsheet',
    'create_html': 'Create an interactive HTML presentation',
    'create_pptx': 'Create a PowerPoint presentation',
    'create_mp4': 'Create an animated video',
    'edit_docx': 'Edit an existing Word document',
    'edit_xlsx': 'Edit an existing spreadsheet',
    'edit_pptx': 'Edit an existing PowerPoint',
    'get_artifact_text': 'Get text from a previously generated artifact',
    'get_artifact_instructions': 'Formatting rules for generating artifacts',
    'get_app_context': 'Info about PALM app and its features',
    'search_conversations': 'Search prior chat conversations',
    'get_recent_conversations': 'Recent conversation activity overview',
    'get_conversation_messages': 'Read messages from a prior conversation',
    'find_artifacts': 'Find artifacts made in prior conversations',
    'get_conversation_artifact': 'Read an artifact from a prior conversation',
    'skill_repo_list': 'List available skill repositories',
    'skill_repo_list_files': 'List files in a skill repo',
    'skill_repo_read_file': 'Read a file from a skill repo',
    'skill_repo_search': 'Search across skill repo files',
    'skill_repo_list_commands': 'List commands in a skill repo',
    'skill_repo_load_command': 'Load command methodology without executing',
    'skill_repo_run_command': 'Execute a skill repo command with a dedicated agent',
}


def _active_tool_names(state: AgenticChatState) -> set[str]:
    """Return the set of tool names available for the current conversation state."""
    available = _tools_for_state(state)
    active = {
        'get_current_date', 'get_federal_holidays', 'get_business_days',
        'get_artifact_instructions', 'get_app_context',
        'get_library_documents', 'create_docx', 'create_xlsx', 'create_html', 'create_pptx', 'create_mp4',
    }
    if state.get('artifact_script_map'):
        active |= {'edit_docx', 'edit_xlsx', 'edit_pptx', 'get_artifact_text'}
    if state.get('memory_enabled'):
        active |= {
            'search_conversations', 'find_artifacts', 'get_recent_conversations',
            'get_conversation_messages', 'get_conversation_artifact',
        }
    if state.get('has_skill_repos', False):
        active |= {
            'skill_repo_list', 'skill_repo_list_files', 'skill_repo_read_file',
            'skill_repo_search', 'skill_repo_list_commands', 'skill_repo_load_command',
            'skill_repo_run_command',
        }
    has_docs = bool(state.get('document_ids'))
    return {t.name for t in available if t.name in active or has_docs}


def _build_tool_catalog(state: AgenticChatState) -> str:
    """Build a lightweight text catalog of available tools for the planner."""
    names = _active_tool_names(state)
    lines = [f'- {name}: {_TOOL_CATALOG[name]}' for name in sorted(names) if name in _TOOL_CATALOG]
    return '\n'.join(lines)


async def _plan_tools(state: AgenticChatState) -> str | list[str]:
    """Planner call: returns 'direct' or a list of tool names."""
    # Build recent conversation history so the planner sees what's being referenced
    recent_lines: list[str] = []
    for m in state['messages']:
        if isinstance(m, HumanMessage):
            recent_lines.append(f'User: {str(m.content)[:300]}')
        elif isinstance(m, AIMessage) and not m.tool_calls:
            recent_lines.append(f'Assistant: {str(m.content)[:300]}')
    # Keep the last few exchanges to stay lightweight
    recent_lines = recent_lines[-6:]
    conversation_ctx = '\n'.join(recent_lines)

    last_human = ''
    for m in reversed(state['messages']):
        if m.type == 'human':
            last_human = str(m.content)
            break

    doc_filenames = [d['filename'] for d in (state.get('injected_document_list') or [])]
    artifact_labels = list((state.get('artifact_script_map') or {}).keys())
    has_docs = bool(state['document_ids'])
    has_memory = bool(state.get('memory_enabled'))

    docs_ctx = f'Yes ({", ".join(doc_filenames)})' if has_docs and doc_filenames else ('Yes' if has_docs else 'No')
    artifacts_ctx = ', '.join(f'"{l}"' for l in artifact_labels) if artifact_labels else 'None'
    memory_ctx = 'Yes' if has_memory else 'No'

    catalog_text = _build_tool_catalog(state)

    plan_prompt = (
        'You are a query planner. Decide how to handle the user\'s request.\n\n'
        'If the question can be answered from general knowledge or conversation history alone, '
        'respond with exactly: direct\n\n'
        'If tools are needed, respond with a comma-separated list of ALL tool names required '
        'to fully complete the request. Include tools for every step (e.g. if the user wants '
        'analysis AND a document, list both the analysis and creation tools).\n\n'
        f'Available tools:\n{catalog_text}\n\n'
        f'Context:\n'
        f'- Documents attached: {docs_ctx}\n'
        f'- Existing artifacts: {artifacts_ctx}\n'
        f'- Memory enabled: {memory_ctx}\n\n'
        f'Recent conversation:\n{conversation_ctx}\n\n'
        'Reply with "direct" or a comma-separated tool list. Nothing else.'
    )

    try:
        planner_model = state.get('fast_model_id') or state['model_id']
        planner_name = state.get('fast_model_name') or planner_model
        logger.info('[AGENTIC-CHAT] planner using model=%s (fast=%s)', planner_name, bool(state.get('fast_model_id')))
        resp = await chat_completion_with_tools(
            user_id=state['user_id'],
            model_id=planner_model,
            messages=[{'role': 'user', 'content': plan_prompt}],
            tools=[],
            temperature=0.0,
            top_p=1.0,
            step_label='plan',
            user_group_id=state.get('user_group_id') or None,
        )
        raw = resp.get('text', '').strip().strip('"\'.')
        if raw.lower() == 'direct':
            return 'direct'
        valid_names = _active_tool_names(state)
        selected = [t.strip() for t in raw.split(',') if t.strip() in valid_names]
        if not selected:
            logger.warning('[AGENTIC-CHAT] planner returned no valid tools from: %s — defaulting to all', raw)
            return list(valid_names)
        return selected
    except Exception as e:
        logger.warning('[AGENTIC-CHAT] planner failed, defaulting to all tools: %s', e)
        return list(_active_tool_names(state))


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

async def agent_node(state: AgenticChatState) -> dict[str, Any]:
    if state.get('final_text'):
        state = {**state, 'final_text': None}

    user_group_id: str | None = state.get('user_group_id') or None

    # Detect whether this is the first agent turn (no tool results yet)
    recent_tool_names: list[str] = []
    for m in reversed(state['messages']):
        if isinstance(m, ToolMessage):
            if m.name:
                recent_tool_names.append(m.name)
        else:
            break
    recent_tool_names.reverse()
    is_first_turn = not recent_tool_names and not state.get('selected_tools')

    # Phase 1: on the first turn, run the planner to decide direct vs tool selection
    if is_first_turn:
        plan_result = await _plan_tools(state)
        if plan_result == 'direct':
            logger.info('[AGENTIC-CHAT] agent_node: planner chose direct')
            # Stream a response with no tools — single call, done
            system_msg = _build_system_message(state)
            api_messages = _messages_to_api_format(
                ([system_msg] + list(state['messages'])) if system_msg else list(state['messages'])
            )
            job_id = state.get('job_id')
            chat_message_id: str | None = state.get('chat_message_id')
            writer = get_stream_writer()
            response: dict[str, Any] = {}
            try:
                thinking_buffer = ''
                thinking_last_emitted = 0
                async for event in stream_chat_completion_with_tools(
                    user_id=state['user_id'],
                    model_id=state['model_id'],
                    messages=api_messages,
                    tools=[],
                    chat_message_id=chat_message_id,
                    user_group_id=user_group_id,
                    step_label='direct',
                ):
                    if event['type'] == 'thinking_delta':
                        thinking_buffer += event.get('text', '')
                        if len(thinking_buffer) - thinking_last_emitted >= 500:
                            thinking_last_emitted = len(thinking_buffer)
                            snippet = thinking_buffer.strip().replace('\n', ' ')
                            await _update_job_progress(job_id, json.dumps({
                                'type': 'thinking',
                                'label': snippet,
                            }))
                    elif event['type'] == 'text_delta':
                        if thinking_buffer and len(thinking_buffer) > thinking_last_emitted:
                            snippet = thinking_buffer.strip().replace('\n', ' ')
                            await _update_job_progress(job_id, json.dumps({
                                'type': 'thinking',
                                'label': snippet,
                            }))
                            thinking_buffer = ''
                            thinking_last_emitted = 0
                        text = event.get('text', '')
                        if text:
                            writer({'type': 'text_delta', 'text': text})
                    elif event['type'] == 'done':
                        if thinking_buffer and len(thinking_buffer) > thinking_last_emitted:
                            snippet = thinking_buffer.strip().replace('\n', ' ')
                            await _update_job_progress(job_id, json.dumps({
                                'type': 'thinking',
                                'label': snippet,
                            }))
                        response = event['response']
                if not response:
                    raise ValueError('Stream ended without a done event')
            except Exception as stream_err:
                logger.warning('[AGENTIC-CHAT] direct streaming failed, falling back: %s', stream_err)
                response = await chat_completion_with_tools(
                    user_id=state['user_id'],
                    model_id=state['model_id'],
                    messages=api_messages,
                    tools=[],
                    chat_message_id=chat_message_id,
                    user_group_id=user_group_id,
                    step_label='direct',
                )
            text = response.get('text', '')
            return {
                'messages': [AIMessage(content=text)],
                'final_text': text,
                'selected_tools': [],
            }

        # Planner selected tools
        selected = plan_result
        logger.info('[AGENTIC-CHAT] agent_node: planner selected tools=%s', selected)
        state = {**state, 'selected_tools': selected}

    # Phase 2: build schemas for selected tools only (first turn) or selected + expanded (subsequent turns)
    selected_names = set(state.get('selected_tools') or [])
    all_available_names = _active_tool_names(state)
    # On subsequent turns, expand with any newly available tools (e.g. edit tools after artifact creation)
    tool_names = (selected_names | all_available_names) if not is_first_turn else selected_names
    available_tools = _tools_for_state(state)
    tools = [
        {
            'name': t.name,
            'description': t.description,
            'inputSchema': t.tool_call_schema.model_json_schema(),
        }
        for t in available_tools
        if t.name in tool_names
    ]

    logger.info(
        '[AGENTIC-CHAT] agent_node: document_ids=%s tools=%s',
        state['document_ids'],
        [t['name'] for t in tools],
    )

    system_msg = _build_system_message(state)
    api_messages = _messages_to_api_format(
        ([system_msg] + list(state['messages'])) if system_msg else list(state['messages'])
    )

    job_id = state.get('job_id')
    chat_message_id: str | None = state.get('chat_message_id')

    # Build a human-readable step label from recent_tool_names (already computed above)
    if not recent_tool_names:
        step_label = 'execute'
    else:
        seen: set[str] = set()
        unique_names: list[str] = []
        for n in recent_tool_names:
            if n not in seen:
                seen.add(n)
                unique_names.append(n)
        step_label = '+'.join(unique_names)

    has_tool_results = bool(recent_tool_names)
    if has_tool_results and job_id:
        await _update_job_progress(job_id, json.dumps({'type': 'thinking', 'label': 'Thinking'}))

    writer = get_stream_writer()
    response: dict[str, Any] = {}
    try:
        thinking_buffer = ''
        thinking_last_emitted = 0

        async for event in stream_chat_completion_with_tools(
            user_id=state['user_id'],
            model_id=state['model_id'],
            messages=api_messages,
            tools=tools,
            chat_message_id=chat_message_id,
            user_group_id=user_group_id,
            step_label=step_label,
        ):
            if event['type'] == 'thinking_delta':
                thinking_buffer += event.get('text', '')
                if len(thinking_buffer) - thinking_last_emitted >= 500:
                    thinking_last_emitted = len(thinking_buffer)
                    snippet = thinking_buffer.strip().replace('\n', ' ')
                    await _update_job_progress(job_id, json.dumps({
                        'type': 'thinking',
                        'label': snippet,
                    }))
            elif event['type'] == 'text_delta':
                if thinking_buffer and len(thinking_buffer) > thinking_last_emitted:
                    snippet = thinking_buffer.strip().replace('\n', ' ')
                    await _update_job_progress(job_id, json.dumps({
                        'type': 'thinking',
                        'label': snippet,
                    }))
                    thinking_buffer = ''
                    thinking_last_emitted = 0
                text = event.get('text', '')
                if text:
                    writer({'type': 'text_delta', 'text': text})
            elif event['type'] == 'tool_start':
                if thinking_buffer and len(thinking_buffer) > thinking_last_emitted:
                    snippet = thinking_buffer.strip().replace('\n', ' ')
                    await _update_job_progress(job_id, json.dumps({
                        'type': 'thinking',
                        'label': snippet,
                    }))
                    thinking_buffer = ''
                    thinking_last_emitted = 0
            elif event['type'] == 'done':
                if thinking_buffer and len(thinking_buffer) > thinking_last_emitted:
                    snippet = thinking_buffer.strip().replace('\n', ' ')
                    await _update_job_progress(job_id, json.dumps({
                        'type': 'thinking',
                        'label': snippet,
                    }))
                    thinking_buffer = ''
                    thinking_last_emitted = 0
                response = event['response']

        if not response:
            raise ValueError('Stream ended without a done event')
    except Exception as stream_err:
        logger.warning('[AGENTIC-CHAT] Streaming failed, falling back to non-streaming: %s', stream_err)
        response = await chat_completion_with_tools(
            user_id=state['user_id'],
            model_id=state['model_id'],
            messages=api_messages,
            tools=tools,
            chat_message_id=chat_message_id,
            user_group_id=user_group_id,
            step_label=step_label,
        )

    logger.info('[AGENTIC-CHAT] agent_node response type=%s tool=%s text_preview=%s', response.get('type'), response.get('toolName', ''), str(response.get('text', ''))[:120])

    # Normalise single and multi tool-call responses into a unified list
    if response['type'] == 'tool_call':
        tool_call_list = [{'toolCallId': response['toolCallId'], 'toolName': response['toolName'], 'toolInput': response.get('toolInput', {})}]
    elif response['type'] == 'tool_calls':
        tool_call_list = response['toolCalls']
    else:
        tool_call_list = []

    if tool_call_list:
        for tc in tool_call_list:
            await _emit_tool_progress(job_id, tc['toolName'], tc.get('toolInput', {}))
        additional_kwargs = {}
        if response.get('rawGeminiContent'):
            additional_kwargs['rawGeminiContent'] = response['rawGeminiContent']
        update: dict[str, Any] = {
            'messages': [AIMessage(
                content='',
                tool_calls=[{
                    'id': tc['toolCallId'],
                    'name': tc['toolName'],
                    'args': tc.get('toolInput', {}),
                    'type': 'tool_call',
                } for tc in tool_call_list],
                additional_kwargs=additional_kwargs,
            )],
        }
        if is_first_turn:
            update['selected_tools'] = list(selected_names)
        return update

    # The planner may have listed artifact tools that never actually got called — e.g. the
    # model narrates producing an output but only invokes one of several planned tools.
    # Nudge it once to finish the plan instead of silently finalizing an incomplete response.
    missing_artifacts = (selected_names & _ARTIFACT_TOOL_NAMES) - _used_tool_names(state['messages'])
    if missing_artifacts and not state.get('artifact_nudge_sent'):
        logger.info('[AGENTIC-CHAT] agent_node: plan incomplete, nudging for %s', sorted(missing_artifacts))
        nudge = HumanMessage(content=(
            'You planned to use these tools but have not called them yet: '
            f'{", ".join(sorted(missing_artifacts))}. Finish the request by calling them now '
            'before giving your final answer.'
        ))
        return {
            'messages': [nudge],
            'artifact_nudge_sent': True,
        }

    text = response['text']

    pending = state.get('pending_artifacts') or []
    if pending:
        artifact_blocks = []
        for artifact in pending:
            ext = artifact.get('extension', '.html')
            encoding = artifact.get('encoding', 'utf-8')
            artifact_blocks.append(f'````artifact("{ext}","{artifact["label"]}","{encoding}")\n{artifact["content"]}\n````')
        final_text = text + '\n\n' + '\n\n'.join(artifact_blocks)
        labels = ', '.join(a.get('label', 'artifact') for a in pending)
        history_text = f'Generated: {labels}.'
    else:
        final_text = text
        history_text = text

    update: dict[str, Any] = {
        'messages': [AIMessage(content=history_text)],
        'final_text': final_text,
        'pending_artifacts': [],
    }
    # Citations are only produced by the retrieval nodes (collect_citations_node /
    # _dispatch_search) so each one carries a genuine source excerpt.
    return update


async def collect_citations_node(state: AgenticChatState) -> dict[str, Any]:
    last_msg = state['messages'][-1]
    job_id = state.get('job_id')
    logger.info('[AGENTIC-CHAT] collect_citations_node: last_msg type=%s name=%s', type(last_msg).__name__, getattr(last_msg, 'name', 'N/A'))
    # Copy the accumulating handle map so the dispatchers can mint/reuse [[E#]]/[[R#]] handles
    # in place; whichever dispatcher runs returns the merged map (replace semantics).
    handle_map: dict[str, Any] = dict(state.get('handle_map') or {})

    if not isinstance(last_msg, ToolMessage):
        return {'citations': state['citations']}

    if last_msg.name == 'get_document_list':
        return {'citations': state['citations']}

    # Collect all ToolMessages from the latest tool turn (multiple parallel tool calls)
    tool_messages: list[ToolMessage] = []
    for msg in reversed(state['messages']):
        if isinstance(msg, ToolMessage):
            tool_messages.append(msg)
        else:
            break
    tool_messages.reverse()

    # Process all search results from this turn
    search_msgs = [m for m in tool_messages if m.name == 'search']
    if search_msgs:
        combined_update: dict[str, Any] = {'citations': state['citations']}
        all_graph_results: list[dict] = []
        for search_msg in search_msgs:
            logger.info('[AGENTIC-CHAT] search raw content: %s', str(search_msg.content)[:500])
            update = _dispatch_search(state, search_msg, handle_map)
            if update:
                counts = update.pop('_dedupe_counts', None)
                deduped_items = update.pop('_deduped_items', [])
                if counts:
                    items_payload = [
                        {
                            'sourceLabel': it.get('sourceLabel', ''),
                            'contextType': it.get('contextType', ''),
                            'citation': (it.get('citation') or '')[:200],
                        }
                        for it in deduped_items[:20]
                    ]
                    full_payload = json.dumps({
                        'type': 'collect_citations',
                        'graphResult': False,
                        'chunks': counts['chunks'],
                        'entities': counts['entities'],
                        'concepts': counts['concepts'],
                        'items': items_payload,
                    })
                    short_log = json.dumps({
                        'type': 'collect_citations',
                        'graphResult': False,
                        'chunks': counts['chunks'],
                        'entities': counts['entities'],
                        'concepts': counts['concepts'],
                        'itemCount': len(items_payload),
                    })
                    await _log_and_progress(job_id, full_payload, log_msg=short_log)
                if update.get('citations'):
                    combined_update['citations'] = update['citations']
                    state = {**state, 'citations': update['citations']}
                graph_results = update.get('graph_search_results')
                if graph_results:
                    all_graph_results.extend(graph_results)
                    row_count = graph_results[-1].get('rowCount', 0) if graph_results else 0
                    await _log_and_progress(
                        job_id,
                        json.dumps({'type': 'collect_citations', 'graphResult': True, 'rowCount': row_count}),
                    )
                for k, v in update.items():
                    if k not in ('citations', 'graph_search_results'):
                        combined_update[k] = v
        if all_graph_results:
            existing = state.get('graph_search_results') or []
            combined_update['graph_search_results'] = existing + all_graph_results
        return combined_update

    if last_msg.name == 'analyze_spreadsheet_data':
        try:
            payload = json.loads(last_msg.content)
        except (json.JSONDecodeError, TypeError):
            payload = {}

        if isinstance(payload, dict) and not payload.get('error'):
            document_id = payload.get('_documentId', '')
            doc_ids: list[str] = state.get('document_ids') or []
            structured_docs: list[dict[str, str]] = state.get('structured_docs') or []
            if not document_id:
                document_id = doc_ids[0] if doc_ids else ''
            filename = next((d['filename'] for d in structured_docs if d['id'] == document_id), document_id)

            answer = payload.get('answer', '')
            citation = {
                'contextType': 'DOCUMENT_LIBRARY',
                'documentId': document_id or (doc_ids[0] if doc_ids else ''),
                'sourceLabel': filename,
                'citation': answer[:300],
            }
            deduped = _dedupe_against_existing([citation], state['citations'])
            update: dict[str, Any] = {'citations': state['citations'] + deduped if deduped else state['citations']}

            return update

    _ARTIFACT_TOOLS = {'create_docx': '.docx', 'create_xlsx': '.xlsx', 'edit_docx': '.docx', 'edit_xlsx': '.xlsx', 'create_html': '.html', 'create_pptx': '.pptx', 'edit_pptx': '.pptx', 'create_mp4': '.mp4', 'edit_artifact': '.txt'}
    # Process every artifact-producing ToolMessage from this turn, not just the last one —
    # the model may call e.g. create_xlsx and create_html together in a single parallel turn.
    artifact_msgs = [m for m in tool_messages if m.name in _ARTIFACT_TOOLS]
    if artifact_msgs:
        args_by_call_id: dict[str, dict[str, Any]] = {}
        for msg in reversed(state['messages']):
            if isinstance(msg, AIMessage) and msg.tool_calls:
                for tc in msg.tool_calls:
                    args_by_call_id[tc.get('id', '')] = tc.get('args', {})
                break

        combined_artifacts: list[dict[str, Any]] = []
        combined_summary_messages: list[ToolMessage] = []
        combined_script_entries: dict[str, dict[str, str]] = {}
        combined_inline_entries: dict[str, dict[str, str]] = {}
        any_failed = False

        for artifact_msg in artifact_msgs:
            default_ext = _ARTIFACT_TOOLS[artifact_msg.name]
            try:
                payload = json.loads(artifact_msg.content)
            except (json.JSONDecodeError, TypeError):
                payload = {}

            if not isinstance(payload, dict) or payload.get('error'):
                any_failed = True
                logger.error('[AGENTIC-CHAT] %s failed — raw_content=%r payload=%s', artifact_msg.name, str(artifact_msg.content)[:500], str(payload)[:500])
                await _update_job_progress(job_id, json.dumps({'type': 'tool_call', 'toolName': artifact_msg.name, 'label': 'Generation failed'}))
                continue

            artifacts_content = payload.get('artifacts', {})
            artifact_errors = payload.get('errors', {})
            args = args_by_call_id.get(artifact_msg.tool_call_id, {})
            title = args.get('title', '') or args.get('artifact_label', '')

            artifacts_list = []
            for key, artifact_data in artifacts_content.items():
                # For edit_docx, fall back to source_json title when the LLM omits artifact_label
                derived_title = title
                if not derived_title and isinstance(artifact_data, dict):
                    sj = artifact_data.get('source_json')
                    if isinstance(sj, dict):
                        derived_title = sj.get('title', '')
                label = derived_title or key.replace('_path', '').replace('_', ' ').title()
                if isinstance(artifact_data, dict):
                    content = artifact_data.get('content', '')
                    extension = artifact_data.get('extension', default_ext)
                    encoding = artifact_data.get('encoding', 'utf-8')
                    source_script = artifact_data.get('source_script')
                    source_json = artifact_data.get('source_json')
                    diff_stat = artifact_data.get('diffStat')
                else:
                    content = artifact_data
                    extension = default_ext
                    encoding = 'utf-8'
                    source_script = None
                    source_json = None
                    diff_stat = None
                artifact_entry: dict[str, Any] = {'label': label, 'content': content, 'extension': extension, 'encoding': encoding}
                if source_script:
                    artifact_entry['source_script'] = source_script
                if source_json is not None:
                    artifact_entry['source_json'] = source_json
                if diff_stat:
                    artifact_entry['diff_stat'] = diff_stat
                artifacts_list.append(artifact_entry)

            if not artifacts_list:
                continue

            logger.info('[AGENTIC-CHAT] %s: queuing %d artifact(s) for injection', artifact_msg.name, len(artifacts_list))
            if job_id and artifact_msg.name.startswith('edit_'):
                for a in artifacts_list:
                    if a.get('diff_stat'):
                        await _update_job_progress(job_id, json.dumps({
                            'type': 'artifact_diff_stat',
                            'toolName': artifact_msg.name,
                            'added': a['diff_stat'].get('added', 0),
                            'removed': a['diff_stat'].get('removed', 0),
                        }))
            labels_str = ', '.join(f'{a["label"]} ({a["extension"]})' for a in artifacts_list)
            error_note = ''
            if artifact_errors:
                failed = ', '.join(artifact_errors.keys())
                logger.warning('[AGENTIC-CHAT] %s: partial failure for output(s): %s', artifact_msg.name, failed)
                error_note = f' Note: generation failed for {failed} — let the user know.'
            msg_id = artifact_msg.id or str(uuid.uuid4())
            combined_summary_messages.append(ToolMessage(
                content=f'Successfully generated: {labels_str}. The artifact will be attached to your response automatically — do not reproduce its content.{error_note}',
                tool_call_id=artifact_msg.tool_call_id,
                name=artifact_msg.name,
                id=msg_id,
            ))
            combined_artifacts.extend(artifacts_list)
            for a in artifacts_list:
                if a.get('source_script') and a.get('extension') in ('.docx', '.xlsx', '.pptx'):
                    combined_script_entries[a['label']] = {'ext': a['extension'], 'script': a['source_script']}
            if artifact_msg.name == 'edit_artifact':
                for a in artifacts_list:
                    combined_inline_entries[a['label']] = {'ext': a['extension'], 'content': a['content']}

        if combined_artifacts:
            existing = state.get('pending_artifacts') or []
            result: dict[str, Any] = {
                'citations': state['citations'],
                'pending_artifacts': existing + combined_artifacts,
                'messages': combined_summary_messages,
            }
            if combined_script_entries:
                existing_map = state.get('artifact_script_map') or {}
                result['artifact_script_map'] = {**existing_map, **combined_script_entries}
            if combined_inline_entries:
                existing_inline = state.get('inline_artifact_content') or {}
                result['inline_artifact_content'] = {**existing_inline, **combined_inline_entries}
            return result
        if any_failed:
            return {'citations': state['citations']}

    if last_msg.name == 'skill_repo_run_command':
        content = last_msg.content or ''
        marker = '\n\n'
        idx = content.find(marker, content.find('SKILL COMMAND COMPLETE'))
        artifact_text = content[idx + len(marker):] if idx >= 0 else content
        # Only auto-inject as artifact if the output is substantial (>500 chars)
        # and isn't a JSON error. Short answers pass through as normal text.
        if artifact_text and not artifact_text.startswith('{') and len(artifact_text) > 500:
            command = 'output'
            for msg in reversed(state['messages']):
                if isinstance(msg, AIMessage) and msg.tool_calls:
                    for tc in msg.tool_calls:
                        if tc.get('name') == 'skill_repo_run_command':
                            command = tc.get('args', {}).get('command', '') or 'output'
                            break
                    if command != 'output':
                        break
            label = command.replace('-', ' ').replace('_', ' ').title()
            # Detect extension from content
            if artifact_text.strip().startswith('<!') or artifact_text.strip().startswith('<html'):
                extension = '.html'
            else:
                extension = '.md'
            artifacts_list = [{'label': label, 'content': artifact_text, 'extension': extension, 'encoding': 'utf-8'}]
            msg_id = last_msg.id or str(uuid.uuid4())
            summary_msg = ToolMessage(
                content=f'Successfully generated: {label} ({extension}). The artifact will be attached to your response automatically — do not reproduce its content.',
                tool_call_id=last_msg.tool_call_id,
                name=last_msg.name,
                id=msg_id,
            )
            return {
                'citations': state['citations'],
                'pending_artifacts': artifacts_list,
                'messages': [summary_msg],
            }

    if last_msg.name == 'cypher_query':
        update = _dispatch_cypher(state, last_msg, handle_map)
        if update:
            graph_results = update.get('graph_search_results')
            if graph_results:
                row_count = graph_results[-1].get('rowCount', 0) if graph_results else 0
                await _log_and_progress(
                    job_id,
                    json.dumps({'type': 'collect_citations', 'graphResult': True, 'rowCount': row_count}),
                )
            return update
        return {'citations': state['citations']}

    memory_tool_names = {
        'search_conversations',
        'find_artifacts',
        'get_recent_conversations',
        'get_conversation_messages',
        'get_conversation_artifact',
    }
    memory_msgs = [m for m in tool_messages if m.name in memory_tool_names]
    if memory_msgs:
        combined_messages: list[ToolMessage] = []
        annotated_count = 0
        for memory_msg in memory_msgs:
            update = _dispatch_memory(state, memory_msg, handle_map)
            replacement_messages = update.get('messages') if update else None
            if not replacement_messages:
                continue
            combined_messages.extend(replacement_messages)
            try:
                annotated_payload = json.loads(replacement_messages[0].content)
            except (json.JSONDecodeError, TypeError):
                annotated_payload = {}
            if memory_msg.name in {'search_conversations', 'find_artifacts'}:
                entries = annotated_payload.get('results', []) if isinstance(annotated_payload, dict) else []
            elif memory_msg.name == 'get_conversation_messages':
                entries = annotated_payload.get('messages', []) if isinstance(annotated_payload, dict) else []
            elif memory_msg.name == 'get_conversation_artifact':
                entries = [annotated_payload] if isinstance(annotated_payload, dict) else []
            else:
                entries = annotated_payload.get('conversations', []) if isinstance(annotated_payload, dict) else []
            if memory_msg.name == 'get_recent_conversations':
                annotated_count += sum(
                    1 for entry in entries
                    if isinstance(entry, dict)
                    and isinstance(entry.get('lastMessage'), dict)
                    and isinstance(entry['lastMessage'].get('handle'), str)
                )
            else:
                annotated_count += sum(
                    1 for entry in entries
                    if isinstance(entry, dict) and isinstance(entry.get('handle'), str)
                )

        await _log_and_progress(
            job_id,
            json.dumps({
                'type': 'collect_citations',
                'conversationResult': True,
                'rowCount': annotated_count,
            }),
        )
        if combined_messages:
            return {'messages': combined_messages, 'handle_map': handle_map}
        return {'citations': state['citations']}

    return {'citations': state['citations']}


def _routing_condition(state: AgenticChatState) -> str:
    last_msg = state['messages'][-1]
    if isinstance(last_msg, AIMessage) and last_msg.tool_calls:
        return 'tools'
    # Loop back into the agent once to act on the artifact-nudge message we just injected
    if isinstance(last_msg, HumanMessage) and state.get('artifact_nudge_sent'):
        return 'agent'
    return END


def _citations_routing_condition(state: AgenticChatState) -> str:
    # If analyze_spreadsheet_data already set final_text, skip agent synthesis entirely
    if state.get('final_text'):
        return END
    return 'agent'


def build_agentic_chat_graph(checkpointer: Any) -> Any:
    graph = StateGraph(AgenticChatState)

    graph.add_node('agent', agent_node)
    graph.add_node('tools', ToolNode(ALL_TOOLS))
    graph.add_node('collect_citations', collect_citations_node)

    graph.set_entry_point('agent')
    graph.add_conditional_edges('agent', _routing_condition, {
        'tools': 'tools',
        'agent': 'agent',
        END: END,
    })
    graph.add_edge('tools', 'collect_citations')
    graph.add_conditional_edges('collect_citations', _citations_routing_condition, {
        'agent': 'agent',
        END: END,
    })

    return graph.compile(checkpointer=checkpointer)
