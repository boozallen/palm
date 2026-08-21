import logging
from typing import Annotated, Any, NotRequired, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

logger = logging.getLogger(__name__)


class AgenticChatState(TypedDict):
    user_id: str
    model_id: str
    chat_id: str
    chat_message_id: NotRequired[str]
    document_ids: list[str]
    structured_docs: list[dict]  # [{id, filename, dataProfile?}] for analyzable docs (csv/xlsx/xls)
    injected_document_list: list[dict]  # [{id, filename}] for all docs in scope — pre-fetched to skip get_document_list
    use_graph: bool  # true when at least one selected document is graphed
    graph_schema: str  # scoped KG schema injected into the system prompt up front (graph mode)
    messages: Annotated[list[BaseMessage], add_messages]
    citations: list[dict[str, Any]]
    final_text: str | None
    job_id: str | None
    graph_search_results: list[dict[str, Any]]
    # Write-time citation. `cite_evidence` turns the citation contract on (prompt clause +
    # handle annotation of tool results); `handle_map` accumulates the `E#`/`R#` -> id/triple
    # mapping the agent cites against. BOTH are sent as input ({} / false) so they are always
    # present in state — a required-but-absent field would fail InjectedState validation for
    # every tool (Annotated[AgenticChatState, InjectedState]) and break all retrieval.
    cite_evidence: bool  # when true (graph mode), cite handles inline
    handle_map: dict[str, Any]  # {'E#': nodeId, 'R#': {'src','relType','tgt'}, 'Q#': resultIndex} accumulated this turn
    pending_artifacts: list[dict[str, str]]  # [{label, content}] — generated artifacts waiting to be appended to LLM response
    artifact_script_map: NotRequired[dict[str, dict[str, str]]]  # {label: {ext, script}} — source scripts for all editable artifact types (.docx/.xlsx/.pptx)
    has_skill_repos: NotRequired[bool]  # true when the user's group has at least one skill repo provider assigned
