from types import SimpleNamespace

from chunk_assembly import assemble_chunks


def _chunk(
    text: str,
    headings: list[str] | None = None,
    page_groups: list[list[int]] | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        text=text,
        meta=SimpleNamespace(
            headings=headings,
            doc_items=[
                SimpleNamespace(
                    prov=[SimpleNamespace(page_no=page_no) for page_no in page_numbers]
                )
                for page_numbers in (page_groups or [])
            ],
        ),
    )


def _contextualize(chunk: SimpleNamespace) -> str:
    return '\n'.join([*(chunk.meta.headings or []), chunk.text])


def _count_tokens(text: str) -> int:
    return len(text.split())


def _utf16_slice(text: str, start: int, end: int) -> str:
    return text.encode('utf-16-le')[2 * start:2 * end].decode('utf-16-le')


def test_assembles_chunks_with_offsets_into_raw_bodies():
    raw_chunks = [
        _chunk('Opening text'),
        _chunk('First section body', ['Section']),
        _chunk('Second section body', ['Section']),
        _chunk('Nested body', ['Section', 'Subsection']),
        _chunk('Closing text', None),
    ]

    text, chunks = assemble_chunks(
        raw_chunks,
        contextualize=_contextualize,
        count_tokens=_count_tokens,
    )

    assert [chunk.index for chunk in chunks] == list(range(len(raw_chunks)))
    for raw_chunk, assembled_chunk in zip(raw_chunks, chunks):
        assert _utf16_slice(
            text,
            assembled_chunk.start_position,
            assembled_chunk.end_position,
        ) == raw_chunk.text
        assert assembled_chunk.content == _contextualize(raw_chunk)
        assert assembled_chunk.token_count == _count_tokens(assembled_chunk.content)

    assert text.count('\n\nSection\n\n') == 1
    assert text.count('\n\nSection\nSubsection\n\n') == 1
    assert 'First section body\n\nSecond section body' in text
    assert 'Nested body\n\nClosing text' in text


def test_drops_empty_chunks_and_renumbers_surviving_chunks():
    dropped_indices: list[int] = []
    raw_chunks = [
        _chunk('First'),
        _chunk('   ', ['Unused heading']),
        _chunk('Last', ['Final heading']),
    ]

    text, chunks = assemble_chunks(
        raw_chunks,
        contextualize=_contextualize,
        count_tokens=_count_tokens,
        log_dropped=dropped_indices.append,
    )

    assert dropped_indices == [1]
    assert [chunk.index for chunk in chunks] == [0, 1]
    assert 'Unused heading' not in text
    assert _utf16_slice(
        text,
        chunks[1].start_position,
        chunks[1].end_position,
    ) == 'Last'


def test_raw_text_round_trips_without_searching_for_content():
    raw_chunks = [
        _chunk('Heading appears inside this Heading body', ['Heading']),
        _chunk('## Heading-like raw text', ['Heading']),
        _chunk(
            'Region, Hours = 24x7\nRegion, Contact = help desk',
            ['Table'],
        ),
    ]

    text, chunks = assemble_chunks(
        raw_chunks,
        contextualize=_contextualize,
        count_tokens=_count_tokens,
    )

    for raw_chunk, assembled_chunk in zip(raw_chunks, chunks):
        assert _utf16_slice(
            text,
            assembled_chunk.start_position,
            assembled_chunk.end_position,
        ) == raw_chunk.text


def test_offsets_use_utf16_code_units_for_astral_characters():
    raw_chunks = [
        _chunk('Intro 😀 text'),
        _chunk('Body with 🎉 inside', ['𝒳 Section']),
        _chunk('Tail', ['𝒳 Section']),
    ]

    text, chunks = assemble_chunks(
        raw_chunks,
        contextualize=_contextualize,
        count_tokens=_count_tokens,
    )

    for raw_chunk, assembled_chunk in zip(raw_chunks, chunks):
        assert _utf16_slice(
            text,
            assembled_chunk.start_position,
            assembled_chunk.end_position,
        ) == raw_chunk.text

    assert any(
        chunk.start_position != text.index(raw_chunk.text)
        for raw_chunk, chunk in zip(raw_chunks, chunks)
    )


def test_bmp_only_offsets_also_work_as_python_string_indices():
    raw_chunks = [
        _chunk('Opening text'),
        _chunk('Section body', ['Section']),
    ]

    text, chunks = assemble_chunks(
        raw_chunks,
        contextualize=_contextualize,
        count_tokens=_count_tokens,
    )

    for raw_chunk, chunk in zip(raw_chunks, chunks):
        assert text[chunk.start_position:chunk.end_position] == raw_chunk.text


def test_offsets_are_increasing_non_overlapping_and_in_bounds():
    raw_chunks = [
        _chunk('One', ['A']),
        _chunk('Two', ['A']),
        _chunk('Three', ['B']),
    ]

    text, chunks = assemble_chunks(
        raw_chunks,
        contextualize=_contextualize,
        count_tokens=_count_tokens,
    )

    for previous, current in zip(chunks, chunks[1:]):
        assert previous.end_position <= current.start_position
    text_length = len(text.encode('utf-16-le')) // 2
    assert all(chunk.end_position <= text_length for chunk in chunks)


def test_carries_full_heading_path_and_page_range_per_chunk():
    raw_chunks = [
        _chunk('Nested body', ['Section', 'Subsection'], [[4, 2], [3]]),
        _chunk('No heading body', None, [[]]),
    ]

    _, chunks = assemble_chunks(
        raw_chunks,
        contextualize=_contextualize,
        count_tokens=_count_tokens,
    )

    assert chunks[0].headings == ('Section', 'Subsection')
    assert chunks[0].page_start == 2
    assert chunks[0].page_end == 4
    assert chunks[1].headings == ()
    assert chunks[1].page_start is None
    assert chunks[1].page_end is None
