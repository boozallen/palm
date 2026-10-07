import base64
import io
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import pypdfium2 as pdfium
import tiktoken
from docling.chunking import HybridChunker
from docling_core.transforms.chunker.line_chunker import LineBasedTokenChunker
from docling.datamodel.base_models import ConversionStatus, DocumentStream, InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.transforms.chunker.tokenizer.openai import OpenAITokenizer
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from chunk_assembly import AssembledChunk, assemble_chunks
from converter_pool import ConverterPool, PoolExhausted


logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)
security = HTTPBearer()

INTERNAL_API_KEY = os.environ.get('INTERNAL_API_KEY', '')
# Each converter holds its own model copy (~232 MB). Keep ≤ CPU count to avoid thrashing.
MAX_CONCURRENCY = 2
# The worker pauses itself for this long before asking again.
BUSY_RETRY_AFTER_SECONDS = 15
# Must be shorter than the Node worker's fetch timeout (10 min) so docling returns an
# error the worker can handle rather than having the HTTP connection cut mid-conversion.
DOCUMENT_TIMEOUT_SECONDS = 480
_ENCODING = tiktoken.get_encoding('cl100k_base')
TEXT_LAYER_MIN_CHARS = 50

IMAGE_CONTENT_TYPES = frozenset({
    'image/png', 'image/jpeg', 'image/gif', 'image/tiff', 'image/bmp', 'image/webp',
})

CONTENT_TYPE_SUFFIXES: dict[str, str] = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/html': '.html',
    'text/markdown': '.md',
}

_text_pool: ConverterPool[DocumentConverter] | None = None
_ocr_pool: ConverterPool[DocumentConverter] | None = None


def _pdf_has_text_layer(file_bytes: bytes, sample_pages: int = 3) -> bool:
    """Sample a few pages to decide whether the PDF has extractable text."""
    try:
        doc = pdfium.PdfDocument(file_bytes)
        for i in range(min(len(doc), sample_pages)):
            page = doc[i]
            textpage = page.get_textpage()
            if len(textpage.get_text_range().strip()) > TEXT_LAYER_MIN_CHARS:
                doc.close()
                return True
        doc.close()
        return False
    except Exception:
        return False


def _utf16_len(text: str) -> int:
    return len(text.encode('utf-16-le')) // 2


def _chunk_csv(
    file_bytes: bytes,
    file_name: str,
    max_tokens: int,
) -> tuple[str, list[AssembledChunk]]:
    """Fast path for CSV: skip DocumentConverter, use LineBasedTokenChunker on raw text.

    HybridChunker pegs CPU for several minutes on large CSVs because it runs a
    4-stage pipeline over the full DoclingDocument tree. LineBasedTokenChunker
    operates directly on the raw string and is orders of magnitude faster.
    """
    text = file_bytes.decode('utf-8', errors='replace')
    lines = text.splitlines(True)

    # Pass the header row as a prefix so every chunk retains column context.
    # chunk_text receives only the data rows (lines[1:]) to avoid duplicating the header.
    # Normalize line ending so the header row is cleanly separated from data rows in every chunk.
    header = (lines[0].rstrip('\r\n') + '\n') if lines else ''
    data_lines = lines[1:] if len(lines) > 1 else lines

    tokenizer = OpenAITokenizer(tokenizer=_ENCODING, max_tokens=max_tokens)
    chunker = LineBasedTokenChunker(tokenizer=tokenizer, prefix=header)

    # chunk_text takes a list of lines and returns a list of plain strings
    chunk_strings = chunker.chunk_text(data_lines)

    text_parts: list[str] = []
    text_length = 0
    assembled: list[AssembledChunk] = []

    for raw_text in chunk_strings:
        if not raw_text.strip():
            logger.warning(
                '[DOCLING] Dropped empty CSV chunk %d for %s', len(assembled), file_name
            )
            continue
        if text_parts:
            sep = '\n\n'
            text_parts.append(sep)
            text_length += _utf16_len(sep)
        start_position = text_length
        text_parts.append(raw_text)
        text_length += _utf16_len(raw_text)
        assembled.append(
            AssembledChunk(
                content=raw_text,
                index=len(assembled),
                token_count=len(_ENCODING.encode(raw_text)),
                start_position=start_position,
                end_position=start_position + _utf16_len(raw_text),
                headings=(),
                page_start=None,
                page_end=None,
            )
        )

    return ''.join(text_parts), assembled


def _get_models_path() -> Path:
    configured_path = os.environ.get('DOCLING_MODELS_PATH')
    if not configured_path:
        raise RuntimeError(
            'DOCLING_MODELS_PATH is required; the image must be rebuilt with Docling models'
        )

    models_path = Path(configured_path)
    if not models_path.is_dir() or not any(models_path.iterdir()):
        raise RuntimeError(
            f'Docling models are missing from {models_path}; the image must be rebuilt'
        )
    return models_path


def _build_converter_pools() -> (
    tuple[ConverterPool[DocumentConverter], ConverterPool[DocumentConverter]]
):
    models_path = _get_models_path()

    text_pdf_options = PdfPipelineOptions(
        artifacts_path=models_path,
        do_ocr=False,
        document_timeout=DOCUMENT_TIMEOUT_SECONDS,
    )
    ocr_pdf_options = PdfPipelineOptions(
        artifacts_path=models_path,
        do_ocr=True,
        ocr_options=TesseractCliOcrOptions(lang=['eng']),
        document_timeout=DOCUMENT_TIMEOUT_SECONDS,
    )

    text_converters: list[DocumentConverter] = []
    for _ in range(MAX_CONCURRENCY):
        converter = DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=text_pdf_options)},
        )
        converter.initialize_pipeline(InputFormat.PDF)
        text_converters.append(converter)

    ocr_converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=ocr_pdf_options),
            InputFormat.IMAGE: PdfFormatOption(pipeline_options=ocr_pdf_options),
        },
    )
    ocr_converter.initialize_pipeline(InputFormat.PDF)

    return ConverterPool(text_converters), ConverterPool([ocr_converter])


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _text_pool, _ocr_pool
    _text_pool, _ocr_pool = _build_converter_pools()
    try:
        yield
    finally:
        _text_pool = None
        _ocr_pool = None


app = FastAPI(lifespan=lifespan)


def _verify_key(credentials: HTTPAuthorizationCredentials = Security(security)) -> None:
    if INTERNAL_API_KEY and credentials.credentials != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail='Unauthorized')


def _file_suffix(content_type: str, file_name: str) -> str:
    if content_type in CONTENT_TYPE_SUFFIXES:
        return CONTENT_TYPE_SUFFIXES[content_type]
    return Path(file_name).suffix or '.bin'


class ParseRequest(BaseModel):
    file_base64: str
    content_type: str
    file_name: str
    max_tokens: int = 800


class ChunkResult(BaseModel):
    """Offsets are UTF-16 code units into extracted_text for Document.text JS slicing."""

    content: str
    index: int
    token_count: int
    start_position: int
    end_position: int
    headings: list[str]
    page_start: int | None
    page_end: int | None


class ParseResponse(BaseModel):
    chunks: list[ChunkResult]
    extracted_text: str


@app.get('/health')
async def health() -> dict:
    return {'status': 'ok'}


@app.post('/parse-and-chunk')
def parse_and_chunk(
    request: ParseRequest,
    _: None = Security(_verify_key),
) -> ParseResponse:
    file_bytes = base64.b64decode(request.file_base64)

    is_csv = (
        request.content_type == 'text/csv'
        or request.file_name.lower().endswith('.csv')
    )

    if is_csv:
        try:
            extracted_text, assembled_chunks = _chunk_csv(
                file_bytes, request.file_name, request.max_tokens
            )
        except Exception as error:
            logger.exception('[DOCLING] CSV chunking failed for %s', request.file_name)
            raise HTTPException(
                status_code=422,
                detail='Document could not be parsed',
            ) from error
    else:
        is_pdf = (
            request.content_type == 'application/pdf'
            or request.file_name.lower().endswith('.pdf')
        )
        is_image = request.content_type in IMAGE_CONTENT_TYPES

        if is_image:
            pool = _ocr_pool
            logger.info('[DOCLING] Image detected for %s, using OCR', request.file_name)
        elif is_pdf and _pdf_has_text_layer(file_bytes):
            pool = _text_pool
            logger.info('[DOCLING] Text layer detected for %s, skipping OCR', request.file_name)
        elif is_pdf:
            pool = _ocr_pool
            logger.info('[DOCLING] No text layer for %s, using OCR', request.file_name)
        else:
            pool = _text_pool

        if pool is None:
            raise HTTPException(
                status_code=503,
                detail='Document parser is busy',
                headers={'Retry-After': str(BUSY_RETRY_AFTER_SECONDS)},
            )

        try:
            with pool.acquire() as converter:
                try:
                    suffix = _file_suffix(request.content_type, request.file_name)
                    file_stem = Path(request.file_name).stem
                    document_stream = DocumentStream(
                        name=f'{file_stem}{suffix}',
                        stream=io.BytesIO(file_bytes),
                    )

                    result = converter.convert(document_stream)

                    if result.status == ConversionStatus.PARTIAL_SUCCESS:
                        logger.warning(
                            '[DOCLING] Partial conversion for %s: %s',
                            request.file_name,
                            result.errors,
                        )

                    tokenizer = OpenAITokenizer(
                        tokenizer=_ENCODING,
                        max_tokens=request.max_tokens,
                    )
                    chunker = HybridChunker(tokenizer=tokenizer)
                    extracted_text, assembled_chunks = assemble_chunks(
                        chunker.chunk(result.document),
                        contextualize=chunker.contextualize,
                        count_tokens=lambda text: len(_ENCODING.encode(text)),
                        log_dropped=lambda index: logger.warning(
                            '[DOCLING] Dropped empty chunk %d for %s',
                            index,
                            request.file_name,
                        ),
                    )
                except Exception as error:
                    logger.exception(
                        '[DOCLING] Document parsing failed for %s',
                        request.file_name,
                    )
                    raise HTTPException(
                        status_code=422,
                        detail='Document could not be parsed',
                    ) from error
        except PoolExhausted as error:
            raise HTTPException(
                status_code=503,
                detail='Document parser is busy',
                headers={'Retry-After': str(BUSY_RETRY_AFTER_SECONDS)},
            ) from error

    if not assembled_chunks:
        raise HTTPException(status_code=422, detail='Document contains no text')

    chunks = [
        ChunkResult(
            content=chunk.content,
            index=chunk.index,
            token_count=chunk.token_count,
            start_position=chunk.start_position,
            end_position=chunk.end_position,
            headings=list(chunk.headings),
            page_start=chunk.page_start,
            page_end=chunk.page_end,
        )
        for chunk in assembled_chunks
    ]
    return ParseResponse(chunks=chunks, extracted_text=extracted_text)
