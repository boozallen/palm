from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AssembledChunk:
    """Offsets are UTF-16 code units into assembled text for Document.text JS slicing."""

    content: str
    index: int
    token_count: int
    start_position: int
    end_position: int
    headings: tuple[str, ...]
    page_start: int | None
    page_end: int | None


def _utf16_length(text: str) -> int:
    return len(text.encode('utf-16-le')) // 2


def assemble_chunks(
    chunks: Iterable[Any],
    *,
    contextualize: Callable[[Any], str],
    count_tokens: Callable[[str], int],
    log_dropped: Callable[[int], None] | None = None,
) -> tuple[str, list[AssembledChunk]]:
    text_parts: list[str] = []
    text_length = 0
    assembled_chunks: list[AssembledChunk] = []
    previous_headings: tuple[str, ...] | None = None

    def append_block(block: str) -> int:
        nonlocal text_length
        if text_parts:
            separator = '\n\n'
            text_parts.append(separator)
            text_length += _utf16_length(separator)
        start_position = text_length
        text_parts.append(block)
        text_length += _utf16_length(block)
        return start_position

    for original_index, chunk in enumerate(chunks):
        raw_text = chunk.text
        if not raw_text.strip():
            if log_dropped is not None:
                log_dropped(original_index)
            continue

        headings = tuple(chunk.meta.headings or [])
        page_numbers = [
            provenance.page_no
            for item in chunk.meta.doc_items
            for provenance in item.prov
        ]
        if headings != previous_headings and headings:
            append_block('\n'.join(headings))

        start_position = append_block(raw_text)
        content = contextualize(chunk)
        assembled_chunks.append(
            AssembledChunk(
                content=content,
                index=len(assembled_chunks),
                token_count=count_tokens(content),
                start_position=start_position,
                end_position=start_position + _utf16_length(raw_text),
                headings=headings,
                page_start=min(page_numbers) if page_numbers else None,
                page_end=max(page_numbers) if page_numbers else None,
            )
        )
        previous_headings = headings

    return ''.join(text_parts), assembled_chunks
