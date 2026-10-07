import logging
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage

from graphs.state import AgenticChatState

logger = logging.getLogger(__name__)

_ARTIFACT_INSTRUCTIONS = r"""## Artifact formatting rules

**CRITICAL: You MUST use the artifact wrapper below. Do NOT use triple-backtick code blocks (```html, ```python, etc.) — those will NOT render as artifacts and will display as raw code to the user.**

Wrap artifact-worthy content with EXACTLY FOUR backticks:
````artifact(".ext","Label")
...artifact content goes here...
````

### When to create an artifact
- Content that is complete, non-trivial, and reusable (typically >250 chars or 15+ lines)
- Do NOT create artifacts for trivial one-liners, demo snippets, or inline tables that fit naturally in prose

### File extension guide
- `.html` — web pages, dashboards, interactive tools, email templates. Must be fully self-contained (inline CSS+JS, no CDN). For HTML/web-based presentations or slide decks (only when explicitly requested), use the `create_html` tool instead of creating HTML directly.
- `.docx` — DO NOT write this directly. To create a new Word document use `create_docx(...)`; to edit an existing one use `edit_docx(...)`. Both use a dedicated subagent that generates a properly styled Word document using python-docx.
- `.pptx` — DO NOT write this directly. To create a new PowerPoint use `create_pptx(...)`; to edit an existing one use `edit_pptx(...)`.
- `.xlsx` — DO NOT write this directly. To create a new spreadsheet use `create_xlsx(...)`; to edit an existing one use `edit_xlsx(...)`. Both use a dedicated subagent that generates a properly formatted Excel file using openpyxl.
- `.mmd` — Mermaid diagrams (default for generic "create a diagram/graph/flowchart" requests)
- `.mp4` — DO NOT write this directly. Always use `create_mp4(...)` — a dedicated subagent writes the VideoSlide JSON with proper narration for text-to-speech.
- `.py`, `.js`, `.ts`, etc. — standalone code files only when user explicitly requests that language
- `.json`, `.xml`, `.yaml` — structured data formats
- `.txt` — last resort only; prefer any other format first
- `.md` — markdown documents

To edit any of the above (`.html`, `.md`, `.py`, `.js`, `.ts`, `.json`, `.xml`, `.yaml`, `.txt`, `.mmd`, etc.) that was previously written in this conversation, call `edit_artifact(artifact_label, changes)` instead of rewriting it inline — never regenerate the whole artifact just to apply a small change.

### Rules
- Use EXACTLY FOUR backticks — never three (triple-backtick code fences are forbidden for artifact content)
- The first argument MUST be ONLY the file extension (e.g. `".html"`, `".py"`, `".md"`) — NEVER a filename or path
- The second argument is the human-readable label
- One artifact per cohesive piece of content; never split a web page into separate HTML/CSS/JS artifacts
- Artifact content must appear only inside the artifact wrapper, never repeated in prose
- For HTML/web-based or interactive presentations (only when explicitly requested), ALWAYS use `create_html(...)` — do NOT write HTML directly
- For videos, ALWAYS use `create_mp4(...)` — do NOT write `.mp4` or VideoSlide JSON directly
- For Word documents (.docx), ALWAYS use `create_docx(...)` — do NOT write .docx content directly
- For presentations/slide decks by default (and any PowerPoint/.pptx mention), ALWAYS use `create_pptx(...)` to create or `edit_pptx(...)` to edit — do NOT write .pptx content directly
- For Excel spreadsheets (.xlsx), ALWAYS use `create_xlsx(...)` to create or `edit_xlsx(...)` to edit — do NOT write .xlsx content directly"""

_FOLLOWUP_INSTRUCTIONS = """\
## Follow-up question rules

Generate 2–3 follow-up questions when your response is open-ended, educational, or invites
deeper exploration (including simple greetings — they can lead to meaningful conversations).

### Format
Wrap each question individually:
`<FOLLOWUP>question text here</FOLLOWUP>`

### Quality guidelines
- Phrase each one as something the user would say to you as their next message — a request or question in the user's voice, directed at you. NEVER phrase it as you asking the user for their preference or a decision (e.g. do NOT write "Would you like a solid color or a gradient?").
- Write complete sentences that make sense as clickable prompts
- Encourage deeper engagement — avoid yes/no questions
- Make questions specific to the content just discussed
- Think from the user's perspective: what would they naturally ask next?

### Examples
- After a greeting: `<FOLLOWUP>Help me create a project</FOLLOWUP>`
- After a technical explanation: `<FOLLOWUP>Can you show me a practical example?</FOLLOWUP>`
- After a recommendation: `<FOLLOWUP>Which option is best for beginners?</FOLLOWUP>`"""

_TOOL_USE_RULES = (
    'ARTIFACT RULES — follow exactly:\n'
    '- To create a new Word document (.docx): ALWAYS call `create_docx(...)`. Never write .docx content directly.\n'
    '- To edit an existing Word document (.docx) — whether uploaded by the user or previously generated: ALWAYS call `edit_docx(...)`. Pass the exact label of the document in `artifact_label` (for generated docs) or leave it empty (for uploaded docs). Never regenerate the whole document with `create_docx` just to apply a small change.\n'
    '- To create a new PowerPoint presentation (.pptx): ALWAYS call `create_pptx(...)`. Never write .pptx content directly.\n'
    '- To edit an existing PowerPoint presentation (.pptx) — previously generated in this conversation: ALWAYS call `edit_pptx(...)`. Pass the exact label of the presentation in `artifact_label` and describe the changes in `changes`. Never regenerate the whole deck with `create_pptx` just to apply a small change.\n'
    '- To create OR regenerate an HTML/web-based or interactive presentation (only when explicitly requested): ALWAYS call `create_html(...)`. Never write presentation HTML directly.\n'
    '- To create OR regenerate a video or animated explainer: ALWAYS call `create_mp4(...)`. Never write .mp4 or VideoSlide JSON directly.\n'
    '- When calling these tools, pass your synthesized findings as `content`. Do NOT write any artifact content yourself.\n'
    '- Available styles for `create_html` and `create_mp4` only: default, corporate-minimal, tech-forward, data-driven, magazine-editorial, executive-brief. These do not apply to `create_pptx` or `create_docx`.\n'
    '- IMPORTANT: Always pass style="default" unless the user explicitly asks for a specific style by name. Do NOT infer a style from the content topic.\n'
    '- To create a new Excel spreadsheet (.xlsx): ALWAYS call `create_xlsx(...)`. Never write .xlsx content directly.\n'
    '- To edit an existing Excel spreadsheet (.xlsx) — whether uploaded by the user or previously generated: ALWAYS call `edit_xlsx(...)`. Pass the exact label in `artifact_label` (for generated spreadsheets) or leave it empty (for uploaded spreadsheets). Never regenerate the whole spreadsheet with `create_xlsx` just to apply a small change.\n'
    '- For all other artifacts (.md, .mmd, .py, etc.): call `get_artifact_instructions` first to get the exact syntax, then write the artifact inline.\n'
    '- To edit one of these other artifacts (.html, .md, .py, .txt, .json, .mmd, etc.) previously written in this conversation: ALWAYS call `edit_artifact(artifact_label, changes)`. Never rewrite the whole artifact inline just to apply a small change.\n'
    '- NEVER write text like "[Artifact generated: ...]" or "system:artifact-delivered" — these are internal system markers, not valid responses.\n'
    'FOLLOW-UP RULES (apply ONLY when your response is conversational or educational — explaining a concept, answering a general question, searching for information, or responding to a greeting; do NOT add follow-ups after analyze_spreadsheet_data, artifact generation, or short factual answers):\n'
    '- Generate 2–3 follow-up questions.\n'
    '- Wrap each question: `<FOLLOWUP>question text here</FOLLOWUP>`\n'
    '- Phrase each one as something the USER would say to you as their next message — a request or question in the user\'s voice, directed at you. NEVER phrase it as you asking the user for their preference or a decision (e.g. do NOT write "Would you like a solid color or a gradient?" or "Do you want the cards updated too?"). Write it as the user\'s own actionable request instead, e.g. "Make the background a solid gradient instead of flat green" or "Update the cards and headers to match the green theme too."\n'
    '- Write complete sentences that make sense as clickable prompts. Encourage deeper engagement — avoid yes/no questions. Make questions specific to the content just discussed.\n'
    'Call `get_app_context` when the user asks about PALM features or capabilities.\n'
    'CLARIFICATION RULE: If the user\'s message contains a question directed at you — even alongside complaints or instructions (e.g. "Also, shouldn\'t you...", "Do you need a reference?", "Can you do X?") — answer that question conversationally in your response. Do NOT silently ignore questions and jump straight to tool calls or artifact generation.'
)

_APP_CONTEXT = """\
## About PALM

PALM (Prompt & Agent Library Marketplace) is an enterprise-ready platform that
connects users to large language models and data sources through a unified interface.

### Main features
- **Chat** (current feature): Conversational interface supporting RAG and GraphRAG over
  uploaded documents, artifact generation, and source citations
- **Workflows**: Agentic multi-step task automation with per-step RAG, artifact output, and citations
- **Prompt Library**: Predefined and customizable prompts for common AI use cases
- **Prompt Generator**: Build custom prompts from scratch with instruction fine-tuning
- **Prompt Playground**: Compare responses across multiple LLM providers and models
- **Profile**: Manage your Document Library, Knowledge Base preselections, and User Groups
- **Analytics**: Usage and cost metrics by user, provider, and model
- **Settings** (admin): LLM integrations, feature flags, data source connections, and RBAC"""


def _render_column_schema(data_profile: dict | None) -> str:
    """Return a compact column schema string from a dataProfile object, or '' if unavailable."""
    if not isinstance(data_profile, dict):
        return ''
    sheets = data_profile.get('sheets') or {}
    lines = []
    for sheet_name, sheet_info in sheets.items():
        if not isinstance(sheet_info, dict):
            continue
        columns = sheet_info.get('columns') or []
        row_count = sheet_info.get('rowCount', '?')
        header = f'    Sheet "{sheet_name}" ({row_count} rows):'
        col_parts = []
        for col in columns:
            if not isinstance(col, dict):
                continue
            name = col.get('name', '')
            dtype = col.get('dtype', '')
            if 'uniqueValues' in col:
                vals = col['uniqueValues'][:8]
                vals_str = ', '.join(str(v) for v in vals)
                col_parts.append(f'{name} ({dtype}: {vals_str})')
            elif 'min' in col and 'max' in col:
                col_parts.append(f'{name} ({dtype}, {col["min"]}–{col["max"]})')
            else:
                col_parts.append(f'{name} ({dtype})')
        lines.append(header)
        lines.append('      ' + ' | '.join(col_parts))
    return '\n'.join(lines)


def _build_artifact_edit_hints(state: AgenticChatState) -> str:
    script_map: dict[str, dict[str, str]] = state.get('artifact_script_map') or {}
    inline_labels: dict[str, str] = state.get('inline_artifact_labels') or {}
    if not script_map and not inline_labels:
        return ''
    by_ext: dict[str, list[str]] = {}
    for label, entry in script_map.items():
        ext = entry.get('ext', '')
        by_ext.setdefault(ext, []).append(label)
    lines = []
    if inline_labels:
        label_list = ', '.join(f'"{l}" ({ext})' for l, ext in inline_labels.items())
        lines.append(
            f'The following artifacts were previously written in this conversation and can be '
            f'edited with `edit_artifact(...)`: {label_list}. '
            f'When the user asks to modify one of these, call `edit_artifact(artifact_label=<exact label above>, changes=...)`. '
            f'Never rewrite the whole artifact inline just to apply a small change.'
        )
    if '.docx' in by_ext:
        label_list = ', '.join(f'"{l}"' for l in by_ext['.docx'])
        lines.append(
            f'The following Word documents (.docx) were previously generated in this conversation '
            f'and can be edited with `edit_docx(...)`: {label_list}. '
            f'When the user asks to modify one of these, call `edit_docx(changes=..., artifact_label=<exact label above>)`.'
        )
    if '.xlsx' in by_ext:
        label_list = ', '.join(f'"{l}"' for l in by_ext['.xlsx'])
        lines.append(
            f'The following Excel spreadsheets (.xlsx) were previously generated in this conversation '
            f'and can be edited with `edit_xlsx(...)`: {label_list}. '
            f'When the user asks to modify one of these, call `edit_xlsx(changes=..., artifact_label=<exact label above>)`.'
        )
    if '.pptx' in by_ext:
        label_list = ', '.join(f'"{l}"' for l in by_ext['.pptx'])
        lines.append(
            f'The following PowerPoint presentations (.pptx) were previously generated in this conversation '
            f'and can be edited with `edit_pptx(...)`: {label_list}. '
            f'When the user asks to modify one of these, call `edit_pptx(changes=..., artifact_label=<exact label above>)`. '
            f'Never regenerate the whole deck with `create_pptx` just to apply a small change.'
        )
    return '\n\n' + '\n\n'.join(lines) if lines else ''


def _build_memory_hint(state: AgenticChatState) -> str:
    if not state.get('memory_enabled'):
        return ''
    base_hint = (
        '\n\nYou can also access the user\'s prior conversations in this app: '
        '`search_conversations` finds verbatim excerpts from earlier chats, '
        '`get_recent_conversations` summarizes recent activity, and '
        '`get_conversation_messages` reads a window of one prior conversation. '
        'Use them when the user refers to past conversations, earlier work, or previous '
        'decisions (e.g. "did we discuss...", "last time", "where did we leave off", '
        '"what have I been working on"). Excerpts are the user\'s own chat history, '
        'not documents. When the user asks about something they made, such as a document, '
        'deck, spreadsheet, report, or artifact, use `find_artifacts` first; it searches '
        'artifact titles and file types, not contents. If title search finds nothing, fall '
        'back to `search_conversations`, because older artifacts may only be described in '
        'conversation text. When an artifact lookup returns multiple plausible matches and '
        'the request does not identify one, ask the user which they mean, showing the label, '
        'date, and source conversation, rather than choosing; a wrong pick with a confident '
        'answer is worse than a clarifying question. To answer questions about a previously '
        'created artifact\'s '
        'contents, read it with `get_conversation_artifact` rather than answering from '
        'conversation excerpts. Artifact and conversation ids must be copied exactly from tool '
        'results in context; if an id lookup fails or no id is at hand, search again with the '
        'memory tools rather than constructing an id or reporting the item unavailable. You '
        'cannot attach existing documents or previously created artifacts to the conversation; '
        'the user controls document selection in the app, while artifacts you generate in your '
        'reply attach automatically as always. When the user wants to use or work '
        'with a previous artifact, read it with `get_conversation_artifact` and work from its '
        'content. For downloading, direct the user to the source conversation reachable from '
        'the citation. Never claim that you performed an action unless a tool call actually '
        'performed it. '
    )
    docs_hint = ''
    if state['document_ids']:
        docs_hint = (
            'When a question is about prior conversations rather than the '
            'attached documents, these tools are the correct retrieval: you do not need to '
            'call `search` first for such questions, and the verbatim excerpts they return '
            'are valid evidence to answer from. For questions that span both, use both '
            'retrievals. The attached documents are not your only context — the user\'s prior '
            'conversations with you are also searchable. If document search returns no '
            'results for something the user\'s request references, you MUST call '
            '`search_conversations` for that same thing before answering, and only report '
            'it as not found if both searches come up empty. When a question about prior '
            'conversations concerns specific entities or concepts, pass their names via '
            'entity_names/concept_names (resolved server-side; aliases also match for '
            'entities) — or their '
            'ids via entity_ids/concept_ids when graph retrieval has already surfaced them — '
            'entity matches find conversations that text search misses. '
        )
    citation_hint = (
        'Every conversation excerpt in those tools\' results and every artifact record returned '
        'by `find_artifacts` carries a citation handle shown as [[C#]]. In recent-conversation overviews, the handle '
        'on the last message cites only that excerpt. When a statement in your answer '
        'draws on a prior conversation excerpt or artifact record, cite its handle immediately after the claim, '
        'e.g. "...we decided to use pgvector [[C3]]." One handle per marker — never a '
        'list or range inside one marker. Cite only excerpts or artifact records your statement actually '
        'draws on, and never write a handle that does not appear in the results.'
    )
    return base_hint + docs_hint + citation_hint


def _build_system_message(state: AgenticChatState) -> SystemMessage | None:
    if not state['document_ids']:
        hint = _build_artifact_edit_hints(state)
        return SystemMessage(content=_TOOL_USE_RULES + hint + _build_memory_hint(state))

    injected_docs: list[dict] = state.get('injected_document_list') or []
    structured_docs: list[dict] = state.get('structured_docs') or []

    # Build per-document lines, embedding column schemas for structured files
    structured_by_id = {d['id']: d for d in structured_docs}
    doc_list_lines_parts = []
    for d in injected_docs:
        doc_id = d['id']
        filename = d['filename']
        structured = structured_by_id.get(doc_id)
        if structured and structured.get('dataProfile'):
            schema = _render_column_schema(structured['dataProfile'])
            if schema:
                doc_list_lines_parts.append(f'  • {filename} (id: {doc_id}) [spreadsheet]\n{schema}\n')
            else:
                doc_list_lines_parts.append(f'  • {filename} (id: {doc_id}) [spreadsheet]\n')
        else:
            doc_list_lines_parts.append(f'  • {filename} (id: {doc_id})\n')
    doc_list_lines = ''.join(doc_list_lines_parts)

    parts = [
        'The user has attached the following documents to this conversation:\n',
        doc_list_lines,
        '\nYou MUST retrieve evidence before answering. Never answer from document filenames or your prior knowledge alone.\n',
        'Required sequence for every question:\n'
        '1. Call `search` (or `analyze_spreadsheet_data` for quantitative questions on spreadsheets) to retrieve evidence from attached documents.\n'
        + (
        '2. Call `skill_repo_list` → `skill_repo_list_commands` → `skill_repo_load_command`.\n'
        '   This is NOT optional. You MUST call all three in sequence before writing any artifact or draft. '
        'The command list (not the repo description) tells you what methodology is available. '
        'Example: a repo might contain /rfi-draft even if the repo name doesn\'t mention RFIs.\n'
        '3. Read the loaded methodology. If it has context-gathering phases (questions, options, '
        'information to collect from the user), ASK those questions now and STOP. Wait for the '
        'user to respond. Do NOT call skill_repo_run_command until you have all required context.\n'
        '4. Once you have all context, call `skill_repo_run_command` with the full collected '
        'context as user_input. Then present the result as an artifact.\n'
        if state.get('has_skill_repos', False) else ''
        ),
        'Each retrieval tool adds typed citations to a collected evidence set. '
        'Whatever ends up in that set is exactly what the user sees as sources for your answer.\n',
        'Your answer must be grounded in those citations. Do not state things outside the evidence you have collected.\n',
        'Refine your queries when results do not match what you need. You may search multiple times.\n'
        'If your search returns no relevant results AND the user\'s question cannot be answered from '
        'the selected documents, you MUST call `get_library_documents` before telling the user the '
        'information is not available. Compare the returned filenames against the documents already '
        'in scope. If any look relevant to the question, tell the user specifically: '
        '"I couldn\'t find that in your selected documents, but you have a document called \'[filename]\' '
        'in your library that may contain this information — consider adding it to the conversation."\n',
    ]

    if structured_docs:
        parts.append(
            '\n\nFor structured data files (Excel/CSV):\n'
            + 'Use `analyze_spreadsheet_data` for quantitative questions (counts, sums, averages, rankings, comparisons, filtering by value).\n'
            + 'Use `search` for general/descriptive questions (overviews, summaries, "what is in this file", "analyze this").\n'
            + 'Pass the user\'s question verbatim to `analyze_spreadsheet_data`. Do NOT add filter conditions or interpret column '
            + 'names as implied filters unless the user explicitly asks to filter.\n'
            + 'Once `analyze_spreadsheet_data` returns a result, do NOT call `search` on the same file — '
            + 'search returns only embedding matches and will contradict the complete computed result.\n'
            + '`analyze_spreadsheet_data` runs Python pandas and returns the exact answer. Trust its output completely.\n'
        )

    parts.append(
        '\n\n`get_text` returns the complete plain text of all documents in scope. '
        'Use it when you need full source coverage before generating or regenerating an artifact — '
        'for example, when adding a new section that requires broad context. '
        'Note: `get_text` does NOT produce citations. Always call `search` first for citations.\n'
        '\n\nFor text documents: use `search` as your primary retrieval tool.\n'
        'Search strategy: search terms must reflect the document\'s subject matter, not the user\'s request phrasing. '
        'Words like "summary", "overview", "analysis", or "key findings" describe what the user wants — they are not '
        'in the document text and will return 0 results. '
        'Instead derive search terms from the filename or the user\'s question: the product name, organization, '
        'technology, or topic the document is about.\n'
        '\n\nArtifact generation sequence: when the user asks you to generate a document, presentation, or video, '
        'you MUST still call `search` first to produce citations, then call the appropriate tool '
        '(`create_docx`, `create_html`, or `create_mp4`) with your synthesized findings as the `content` parameter.\n'
    )

    if state.get('use_graph'):
        graph_guidance = (
            '\n\n'
            'A knowledge graph of the attached documents is available via the `cypher_query` tool. '
            'For questions about how entities or concepts relate, or for structural / counting '
            'questions, prefer `cypher_query` (one graph traversal) over repeated `search` calls. '
            'Graph queries supplement search — they do not replace it.\n'
        )
        schema = state.get('graph_schema') or ''
        if schema:
            graph_guidance += (
                'Use the schema below to phrase precise sub-questions, and match type / category / '
                'relationType values exactly as listed.\n'
                '\n'
                'GRAPH SCHEMA (scoped to the selected documents):\n'
                f'{schema}\n'
            )
        if state.get('cite_evidence'):
            graph_guidance += (
                '\n'
                'Every search/graph result is labeled with citation handles — entities and concepts '
                'as [[E#]], relationships as [[R#]]. When a statement in your answer draws on the '
                'graph, cite the handles it uses inline, immediately after the claim. Cite ONLY the '
                'handles your statement actually asserts — do not cite a handle just because it was '
                'retrieved.\n'
                'Cite an ENTITY by WRAPPING its name in the handle: write the handle, a colon, then '
                'the exact entity text as it appears in your sentence, e.g. [[E12:Eclypsium]]. The '
                'wrapped name must be PLAIN text — no markdown, and no "]" character inside it — and '
                'do NOT also bold a cited entity name; the citation styling already emphasizes it.\n'
                'A handle is bound to ONE specific entity — the one shown beside it in the results. '
                'Cite that entity every time you mention it; the same handle may appear many times, '
                'including on short forms or aliases, as long as it always wraps that same entity. But '
                'NEVER attach a handle to a different entity than the one it was assigned to. If a name '
                'has no handle in the results, write it as plain text with no citation — leaving names '
                'uncited is expected and correct.\n'
                'Cite a RELATIONSHIP the same way as an entity — WRAP the words that state the '
                'relationship in the handle (handle, a colon, then the exact phrase as it appears '
                'in your sentence, PLAIN text, no markdown and no "]" inside it), e.g. '
                '[[R4:partners with]]. State the SUBSTANCE of the relationship from the evidence — '
                'what it actually is — not merely that one exists: write '
                '"[[E1:Acme]] [[R1:supplies sorting arms to]] [[E2:Division]]", never '
                '"[[E1:Acme]] and [[E2:Division]] are [[R1:related]]". '
                'Example: "[[E12:Eclypsium]] [[R4:partners with]] [[E7:CISA]]." '
                'If no phrase fits, a bare [[R#]] right after the claim is an acceptable fallback.\n'
                'Each marker holds EXACTLY ONE handle: write [[R1]] [[R2]] [[R3]], never a range or '
                'list inside one marker like [[R1-R20]] or [[E1, E2]] — those do not resolve and '
                'render as broken text. To ground a claim on many handles at once, cite the single '
                '[[Q#]] for the whole result instead of listing them.\n'
                'Each search/graph result also carries a query handle, shown as its `queryHandle` '
                '(e.g. [[Q1]]). When your answer rests on an ENTIRE result set — e.g. "all the '
                'connections between agencies and companies" — cite that result\'s [[Q#]] instead of '
                'listing every item; the whole set becomes the evidence. Use [[E#]]/[[R#]] when your '
                'answer is about specific entities or relationships. Prefer [[Q#]] for '
                '"all / every / how are X connected" answers, especially when a result was too large '
                'to list row-by-row.\n'
                'When the question is about how two entities relate, cite the [[R#]] relationship '
                'handle(s) for the connecting edge.\n'
            )
        parts.append(graph_guidance)

    parts.append(
        '\n\nYour final answer should stay scoped to the question. If the question is about '
        'specific entities or relationships, your answer should stay scoped to those. If the '
        'question is broader, a broader scope is appropriate. Before submitting your final answer, '
        'ask yourself: "Is this answer complete and sufficient to answer the question? Does this '
        'answer include information that would be irrelevant or misleading to the asker?"'
    )

    parts.append('\n\nNever claim documents are missing or unavailable.')
    parts.append('\n\n' + _TOOL_USE_RULES)
    hint = _build_artifact_edit_hints(state)
    if hint:
        parts.append(hint)
    parts.append(_build_memory_hint(state))

    return SystemMessage(content=''.join(parts))


def _messages_to_api_format(messages: list[BaseMessage]) -> list[dict[str, Any]]:
    # Build a lookup of tool_call_id → ToolMessage so we can pair results with calls
    tool_results: dict[str, ToolMessage] = {}
    for msg in messages:
        if isinstance(msg, ToolMessage) and msg.tool_call_id:
            tool_results[msg.tool_call_id] = msg

    emitted_tool_ids: set[str] = set()
    result = []
    for msg in messages:
        if isinstance(msg, SystemMessage):
            result.append({'role': 'system', 'content': str(msg.content)})
        elif isinstance(msg, HumanMessage):
            result.append({'role': 'user', 'content': str(msg.content)})
        elif isinstance(msg, AIMessage):
            if msg.tool_calls:
                raw_gemini = msg.additional_kwargs.get('rawGeminiContent')
                # Emit each tool_call immediately followed by its tool_result
                # so providers that require paired ordering (Bedrock) are satisfied.
                for tc in msg.tool_calls:
                    entry: dict[str, Any] = {
                        'role': 'tool_call',
                        'toolCallId': tc['id'],
                        'toolName': tc['name'],
                        'toolInput': tc['args'],
                    }
                    if raw_gemini:
                        entry['rawGeminiContent'] = raw_gemini
                    result.append(entry)
                    tr = tool_results.get(tc['id'])
                    if tr:
                        result.append({
                            'role': 'tool',
                            'toolCallId': tr.tool_call_id,
                            'content': str(tr.content),
                        })
                        emitted_tool_ids.add(tc['id'])
            else:
                result.append({'role': 'assistant', 'content': str(msg.content)})
        elif isinstance(msg, ToolMessage):
            if msg.tool_call_id not in emitted_tool_ids:
                result.append({
                    'role': 'tool',
                    'toolCallId': msg.tool_call_id,
                    'content': str(msg.content),
                })
    return result
