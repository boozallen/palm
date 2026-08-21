import asyncio
import base64
import logging
import os
import shutil
import sys
import tempfile
from datetime import date as _date
from pathlib import Path

from claude_agent_sdk import (
    query, ClaudeAgentOptions, AssistantMessage, ResultMessage,
    ToolUseBlock, ToolResultBlock, ThinkingBlock, TextBlock, UserMessage,
)
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from lib.agent_env import agent_env
from lib.auth import verify_auth
from lib.job_progress import post_event
from lib.skill_loader import load_skill, SKILLS_DIR

logger = logging.getLogger(__name__)

router = APIRouter()

sys.path.insert(0, str(SKILLS_DIR / 'pptx'))

class CreateDocxRequest(BaseModel):
    model_id: str
    user_id: str
    chat_message_id: str | None = None
    content: str
    title: str = ''
    job_id: str | None = None


class EditDocxRequest(BaseModel):
    model_id: str
    user_id: str
    chat_message_id: str | None = None
    data_b64: str
    filename: str = ''
    changes: str
    job_id: str | None = None


class CreateHtmlRequest(BaseModel):
    model_id: str
    user_id: str
    chat_message_id: str | None = None
    content: str
    title: str = ''
    style: str = 'default'
    feedback: str = ''
    job_id: str | None = None


class CreateMp4Request(BaseModel):
    model_id: str
    user_id: str
    chat_message_id: str | None = None
    content: str
    title: str = ''
    style: str = 'default'
    feedback: str = ''
    job_id: str | None = None


@router.post('/create-docx')
async def create_docx(request: Request, body: CreateDocxRequest):
    verify_auth(request)

    output_dir = Path(tempfile.mkdtemp(prefix='docx-'))
    output_path = output_dir / 'document.docx'

    try:
        today = _date.today().strftime('%B %d, %Y')
        logger.info('[CLAUDE-SERVICE] create-docx title=%r', body.title[:60])

        skill_prompt = load_skill('document')
        prompt = (
            f'{skill_prompt}\n\n'
            f'---\n\n'
            f'## Task\n\n'
            f'Create a Word document from the following content.\n\n'
            f'Title: {body.title}\n'
            f'Today\'s date: {today}\n\n'
            f'Content:\n{body.content}\n\n'
            f'Write the complete file to: {output_path}\n'
            f'Print `DONE: {output_path}` when complete.\n'
        )

        options = ClaudeAgentOptions(
            tools=['Bash'],
            allowed_tools=['Bash'],
            model=body.model_id,
            env=agent_env(body.user_id, body.chat_message_id),
        )

        if body.job_id:
            await post_event(body.job_id, {'type': 'subagent_progress', 'label': 'Generating document...'})

        source_script: str | None = None
        gen_step = 0
        pending_tool_calls: dict[str, dict] = {}
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        gen_step += 1
                        raw_input = block.input if isinstance(block.input, dict) else {}
                        pending_tool_calls[block.id] = {'tool': block.name, 'step': gen_step}
                        if block.name == 'Bash' and isinstance(raw_input, dict):
                            cmd = raw_input.get('command', '')
                            if "require('docx')" in cmd or 'Packer' in cmd:
                                source_script = cmd
                        if body.job_id:
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_call',
                                'tool': block.name,
                                'args': _sanitize_tool_args(block.name, raw_input),
                                'step': gen_step,
                            })
                    elif isinstance(block, ThinkingBlock) and body.job_id:
                        await post_event(body.job_id, {
                            'type': 'subagent_thinking',
                            'step': gen_step,
                            'length': len(block.thinking),
                        })
            elif isinstance(message, UserMessage) and body.job_id:
                if isinstance(message.content, list):
                    for block in message.content:
                        if isinstance(block, ToolResultBlock):
                            call_info = pending_tool_calls.pop(block.tool_use_id, None)
                            content_len = len(block.content) if isinstance(block.content, str) else 0
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_result',
                                'tool': call_info['tool'] if call_info else 'unknown',
                                'step': call_info['step'] if call_info else gen_step,
                                'contentLength': content_len,
                                'isError': block.is_error or False,
                            })
            elif isinstance(message, ResultMessage) and body.job_id:
                await post_event(body.job_id, {
                    'type': 'subagent_complete',
                    'label': 'Document generation complete',
                    'durationMs': message.duration_ms,
                })

        if not output_path.exists():
            raise HTTPException(status_code=422, detail='Document generation failed — agent did not produce a file')

        raw = output_path.read_bytes()
        content = base64.b64encode(raw).decode('ascii')

        section_count: int | None = None
        try:
            from docx import Document as _Document
            _doc = _Document(str(output_path))
            section_count = sum(1 for p in _doc.paragraphs if p.style.name.startswith('Heading 1'))
        except Exception:
            pass

        logger.info('[CLAUDE-SERVICE] create-docx complete sections=%s', section_count)
        return {
            'artifacts': {
                'content': content,
                'extension': '.docx',
                'encoding': 'base64',
            },
            'source_script': source_script,
            'section_count': section_count,
        }
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


@router.post('/edit-docx')
async def edit_docx_endpoint(request: Request, body: EditDocxRequest):
    verify_auth(request)

    output_dir = Path(tempfile.mkdtemp(prefix='docx-edit-'))
    output_path = output_dir / 'document.docx'

    try:
        today = _date.today().strftime('%B %d, %Y')
        logger.info('[CLAUDE-SERVICE] edit-docx changes=%r', body.changes[:120])

        skill_prompt = load_skill('document')

        if not body.data_b64:
            raise HTTPException(status_code=422, detail='edit-docx requires data_b64')

        raw_suffix = Path(body.filename).suffix.lower() if body.filename else '.docx'
        input_suffix = raw_suffix if raw_suffix in ('.docx', '.dotx') else '.docx'
        input_path = output_dir / f'input{input_suffix}'
        input_path.write_bytes(base64.b64decode(body.data_b64))
        unpack_dir = output_dir / 'unpacked'
        merge_runs_script = SKILLS_DIR / 'document' / 'merge_runs.py'
        prompt = (
            f'{skill_prompt}\n\n'
            f'---\n\n'
            f'## Task\n\n'
            f'Edit the Word document using the unzip/XML/rezip approach '
            f'(docx-js cannot open existing files).\n\n'
            f'Today\'s date: {today}\n'
            f'Input file: {input_path}\n'
            f'Unpack to: {unpack_dir}\n'
            f'Output file: {output_path}\n\n'
            f'Requested changes:\n{body.changes}\n\n'
            f'## Length reduction rule\n\n'
            f'If the requested changes ask to shorten, condense, reduce to a page count, or make '
            f'the document more concise, follow this order strictly:\n\n'
            f'1. **Rewrite the text to be shorter.** Cut sentences, tighten wording, remove '
            f'redundant sections. This is the only acceptable way to reduce length.\n'
            f'2. Do NOT reduce font sizes. Do NOT reduce spacing or margins. Do NOT squeeze '
            f'the layout. A document with tiny fonts or no breathing room looks broken and is '
            f'worse than a document that is slightly too long.\n'
            f'3. After rewriting, render once to check the page count. If it still overflows '
            f'by a small amount, cut a little more text — do not touch fonts or spacing.\n'
            f'4. It is acceptable to end up slightly over the target page count if the content '
            f'cannot be cut further without losing meaning. Never sacrifice readability for a '
            f'hard page count.\n\n'
            f'Steps:\n'
            f'1. `unzip -q {input_path} -d {unpack_dir}/`\n'
            f'2. `python {merge_runs_script} {unpack_dir}/` — coalesces fragmented runs so text is findable\n'
            f'3. Edit `{unpack_dir}/word/document.xml` in place — do NOT reformat or pretty-print.\n'
            f'4. `(cd {unpack_dir} && rm -f {output_path} && zip -Xr {output_path} .)`\n'
            f'5. Verify the output renders correctly with soffice + pdftoppm, fix if needed.\n'
            f'6. Print `DONE: {output_path}` when complete.\n'
        )

        options = ClaudeAgentOptions(
            tools=['Bash'],
            allowed_tools=['Bash'],
            model=body.model_id,
            env=agent_env(body.user_id, body.chat_message_id),
        )

        if body.job_id:
            await post_event(body.job_id, {'type': 'subagent_progress', 'label': 'Applying edits to document...'})

        source_script: str | None = None
        gen_step = 0
        pending_tool_calls: dict[str, dict] = {}
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        gen_step += 1
                        raw_input = block.input if isinstance(block.input, dict) else {}
                        pending_tool_calls[block.id] = {'tool': block.name, 'step': gen_step}
                        if block.name == 'Bash' and isinstance(raw_input, dict):
                            cmd = raw_input.get('command', '')
                            if "require('docx')" in cmd or 'Packer' in cmd:
                                source_script = cmd
                        if body.job_id:
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_call',
                                'tool': block.name,
                                'args': _sanitize_tool_args(block.name, raw_input),
                                'step': gen_step,
                            })
                    elif isinstance(block, ThinkingBlock) and body.job_id:
                        await post_event(body.job_id, {
                            'type': 'subagent_thinking',
                            'step': gen_step,
                            'length': len(block.thinking),
                        })
            elif isinstance(message, UserMessage) and body.job_id:
                if isinstance(message.content, list):
                    for block in message.content:
                        if isinstance(block, ToolResultBlock):
                            call_info = pending_tool_calls.pop(block.tool_use_id, None)
                            content_len = len(block.content) if isinstance(block.content, str) else 0
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_result',
                                'tool': call_info['tool'] if call_info else 'unknown',
                                'step': call_info['step'] if call_info else gen_step,
                                'contentLength': content_len,
                                'isError': block.is_error or False,
                            })
            elif isinstance(message, ResultMessage) and body.job_id:
                await post_event(body.job_id, {
                    'type': 'subagent_complete',
                    'label': 'Document edit complete',
                    'durationMs': message.duration_ms,
                })

        if not output_path.exists():
            raise HTTPException(status_code=422, detail='Document edit failed — agent did not produce a file')

        raw = output_path.read_bytes()
        content = base64.b64encode(raw).decode('ascii')

        section_count: int | None = None
        try:
            from docx import Document as _Document
            _doc = _Document(str(output_path))
            section_count = sum(1 for p in _doc.paragraphs if p.style.name.startswith('Heading 1'))
        except Exception:
            pass

        logger.info('[CLAUDE-SERVICE] edit-docx complete sections=%s', section_count)
        return {
            'artifacts': {
                'content': content,
                'extension': '.docx',
                'encoding': 'base64',
            },
            'source_script': source_script,
            'section_count': section_count,
        }
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


@router.post('/create-html')
async def create_html(request: Request, body: CreateHtmlRequest):
    verify_auth(request)

    job_id = body.job_id or os.urandom(8).hex()
    output_dir = Path(tempfile.mkdtemp(prefix='html-'))
    output_path = output_dir / 'html-presentation.html'

    try:
        logger.info('[CLAUDE-SERVICE] create-html title=%r', body.title[:60])

        result = await _run_agent_skill(
            skill_name='html-presentation',
            output_type='HTML presentation',
            output_path=output_path,
            model_id=body.model_id,
            user_id=body.user_id,
            chat_message_id=body.chat_message_id,
            title=body.title,
            content=body.content,
            style=body.style,
            feedback=body.feedback,
            job_id=body.job_id,
        )

        if not output_path.exists():
            raise HTTPException(status_code=422, detail='HTML presentation generation failed')

        content = output_path.read_text(encoding='utf-8')

        return {'artifacts': {
            'content': content,
            'extension': '.html',
            'encoding': 'utf-8',
        }}
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


class CreatePptxRequest(BaseModel):
    model_id: str
    internal_model_id: str = ''
    user_id: str
    chat_message_id: str | None = None
    content: str
    title: str = ''
    job_id: str | None = None


class CreateXlsxRequest(BaseModel):
    model_id: str
    user_id: str
    chat_message_id: str | None = None
    content: str
    title: str = ''
    job_id: str | None = None


class EditXlsxRequest(BaseModel):
    model_id: str
    user_id: str
    chat_message_id: str | None = None
    source_script: str = ''
    data_b64: str = ''
    filename: str = ''
    changes: str
    title: str = ''
    job_id: str | None = None


@router.post('/create-pptx')
async def create_pptx(request: Request, body: CreatePptxRequest):
    verify_auth(request)

    output_dir = Path(tempfile.mkdtemp(prefix='pptx-'))
    output_path = output_dir / 'presentation.pptx'

    try:
        logger.info('[CLAUDE-SERVICE] create-pptx title=%r', body.title[:60])

        source_script, gen_step, pending_tool_calls = '', 0, {}

        skill_prompt = load_skill('pptx')
        env = agent_env(body.user_id, body.chat_message_id)
        setup_code = (
            f'import sys\n'
            f'sys.path.insert(0, \'/app/skills/pptx\')\n'
            f'from slide_factory import *\n'
            f'prs = load_group_template('
            f'{body.user_id!r}, '
            f'{env["ANTHROPIC_BASE_URL"]!r}, '
            f'{env["ANTHROPIC_API_KEY"]!r})\n'
        )
        template_instruction = (
            f'```python\n{setup_code}```\n'
            f'Call only factory functions — do NOT call Presentation() directly '
            f'or reference slide_layouts by index.\n'
        )
        prompt = (
            f'{skill_prompt}\n\n'
            f'---\n\n'
            f'## Setup\n\n'
            f'{template_instruction}\n'
            f'---\n\n'
            f'## Task\n\n'
            f'Generate a PowerPoint presentation from the following content.\n'
            f'\nTitle: {body.title}\n\n'
            f'Content:\n{body.content}\n\n'
            f'Write the complete file to: {output_path}\n'
            f'Print `DONE: {output_path}` when complete.\n'
        )

        options = ClaudeAgentOptions(
            tools=['Bash'],
            allowed_tools=['Bash'],
            model=body.model_id,
            env=env,
        )

        if body.job_id:
            await post_event(body.job_id, {'type': 'subagent_progress', 'label': 'Generating presentation...'})

        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        gen_step += 1
                        raw_input = block.input if isinstance(block.input, dict) else {}
                        cmd = raw_input.get('command', '')
                        if 'from pptx' in cmd or 'python-pptx' in cmd or 'prs.save' in cmd or output_path.stem in cmd:
                            source_script = cmd
                        if body.job_id:
                            pending_tool_calls[block.id] = {'tool': block.name, 'step': gen_step}
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_call',
                                'tool': block.name,
                                'args': _sanitize_tool_args(block.name, raw_input),
                                'step': gen_step,
                            })
                    elif isinstance(block, ThinkingBlock) and body.job_id:
                        await post_event(body.job_id, {
                            'type': 'subagent_thinking',
                            'step': gen_step,
                            'length': len(block.thinking),
                        })
            elif isinstance(message, UserMessage) and body.job_id:
                if isinstance(message.content, list):
                    for block in message.content:
                        if isinstance(block, ToolResultBlock):
                            call_info = pending_tool_calls.pop(block.tool_use_id, None)
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_result',
                                'tool': call_info['tool'] if call_info else 'unknown',
                                'step': call_info['step'] if call_info else gen_step,
                                'contentLength': len(block.content) if isinstance(block.content, str) else 0,
                                'isError': block.is_error or False,
                            })
            elif isinstance(message, ResultMessage) and body.job_id:
                await post_event(body.job_id, {
                    'type': 'subagent_complete',
                    'label': 'Presentation generation complete',
                    'durationMs': message.duration_ms,
                })

        if not output_path.exists():
            raise HTTPException(status_code=422, detail='Presentation generation failed — agent did not produce a file')

        content = base64.b64encode(output_path.read_bytes()).decode('ascii')
        logger.info('[CLAUDE-SERVICE] create-pptx complete')

        return {
            'artifacts': {
                'content': content,
                'extension': '.pptx',
                'encoding': 'base64',
            },
            'source_script': source_script,
        }
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


class EditPptxRequest(BaseModel):
    model_id: str
    internal_model_id: str = ''
    user_id: str
    chat_message_id: str | None = None
    source_script: str
    changes: str
    job_id: str | None = None


@router.post('/edit-pptx')
async def edit_pptx(request: Request, body: EditPptxRequest):
    verify_auth(request)

    output_dir = Path(tempfile.mkdtemp(prefix='pptx-edit-'))
    output_path = output_dir / 'presentation.pptx'

    try:
        logger.info('[CLAUDE-SERVICE] edit-pptx changes=%r', body.changes[:120])

        skill_prompt = load_skill('pptx')

        if body.job_id:
            await post_event(body.job_id, {'type': 'subagent_progress', 'label': 'Applying edits to presentation...'})

        prompt = (
            f'{skill_prompt}\n\n'
            f'---\n\n'
            f'## Task\n\n'
            f'Edit the existing PowerPoint presentation by applying the requested changes to the script below.\n\n'
            f'Requested changes:\n{body.changes}\n\n'
            f'Existing script:\n```python\n{body.source_script}\n```\n\n'
            f'Rewrite the script incorporating the changes, then execute it to produce the updated file.\n'
            f'Write the complete file to: {output_path}\n'
            f'Print `DONE: {output_path}` when complete.\n'
        )

        options = ClaudeAgentOptions(
            tools=['Bash'],
            allowed_tools=['Bash'],
            model=body.model_id,
            env=agent_env(body.user_id, body.chat_message_id),
        )

        new_source_script = ''
        gen_step, pending_tool_calls = 0, {}
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        gen_step += 1
                        raw_input = block.input if isinstance(block.input, dict) else {}
                        cmd = raw_input.get('command', '')
                        if 'from pptx' in cmd or 'slide_factory' in cmd or 'prs.save' in cmd or output_path.stem in cmd:
                            new_source_script = cmd
                        if body.job_id:
                            pending_tool_calls[block.id] = {'tool': block.name, 'step': gen_step}
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_call',
                                'tool': block.name,
                                'args': _sanitize_tool_args(block.name, raw_input),
                                'step': gen_step,
                            })
                    elif isinstance(block, ThinkingBlock) and body.job_id:
                        await post_event(body.job_id, {
                            'type': 'subagent_thinking',
                            'step': gen_step,
                            'length': len(block.thinking),
                        })
            elif isinstance(message, UserMessage) and body.job_id:
                if isinstance(message.content, list):
                    for block in message.content:
                        if isinstance(block, ToolResultBlock):
                            call_info = pending_tool_calls.pop(block.tool_use_id, None)
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_result',
                                'tool': call_info['tool'] if call_info else 'unknown',
                                'step': call_info['step'] if call_info else gen_step,
                                'contentLength': len(block.content) if isinstance(block.content, str) else 0,
                                'isError': block.is_error or False,
                            })
            elif isinstance(message, ResultMessage) and body.job_id:
                await post_event(body.job_id, {
                    'type': 'subagent_complete',
                    'label': 'Presentation edit complete',
                    'durationMs': message.duration_ms,
                })

        if not output_path.exists():
            raise HTTPException(status_code=422, detail='Presentation edit failed — agent did not produce a file')

        content = base64.b64encode(output_path.read_bytes()).decode('ascii')
        logger.info('[CLAUDE-SERVICE] edit-pptx complete')

        return {
            'artifacts': {
                'content': content,
                'extension': '.pptx',
                'encoding': 'base64',
            },
            'source_script': new_source_script or body.source_script,
        }
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


class DocxPreviewRequest(BaseModel):
    binaryContent: str
    artifactId: str


@router.post('/docx-preview')
async def docx_preview(request: Request, body: DocxPreviewRequest):
    verify_auth(request)

    tmp_dir = Path(tempfile.mkdtemp(prefix='docx-preview-'))
    try:
        docx_path = tmp_dir / 'document.docx'
        docx_path.write_bytes(base64.b64decode(body.binaryContent))

        lo_proc = await asyncio.create_subprocess_exec(
            'libreoffice', '--headless', '--convert-to', 'pdf',
            '--outdir', str(tmp_dir), str(docx_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, lo_stderr = await lo_proc.communicate()
        if lo_proc.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f'LibreOffice conversion failed: {lo_stderr.decode(errors="replace")}',
            )

        pdf_path = tmp_dir / 'document.pdf'
        if not pdf_path.exists():
            raise HTTPException(status_code=422, detail='PDF not produced by LibreOffice')

        page_prefix = str(tmp_dir / 'page')
        pp_proc = await asyncio.create_subprocess_exec(
            'pdftoppm', '-png', '-r', '150', str(pdf_path), page_prefix,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, pp_stderr = await pp_proc.communicate()
        if pp_proc.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f'pdftoppm failed: {pp_stderr.decode(errors="replace")}',
            )

        page_files = sorted(tmp_dir.glob('page-*.png'))
        pages = [base64.b64encode(f.read_bytes()).decode('ascii') for f in page_files]

        logger.info('[CLAUDE-SERVICE] docx-preview artifactId=%s pages=%d', body.artifactId, len(pages))
        return {'pages': pages, 'count': len(pages)}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


class PptxPreviewRequest(BaseModel):
    binaryContent: str
    artifactId: str


@router.post('/pptx-preview')
async def pptx_preview(request: Request, body: PptxPreviewRequest):
    verify_auth(request)

    tmp_dir = Path(tempfile.mkdtemp(prefix='pptx-preview-'))
    try:
        pptx_path = tmp_dir / 'presentation.pptx'
        pptx_path.write_bytes(base64.b64decode(body.binaryContent))

        lo_proc = await asyncio.create_subprocess_exec(
            'libreoffice', '--headless', '--convert-to', 'pdf',
            '--outdir', str(tmp_dir), str(pptx_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, lo_stderr = await lo_proc.communicate()
        if lo_proc.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f'LibreOffice conversion failed: {lo_stderr.decode(errors="replace")}',
            )

        pdf_path = tmp_dir / 'presentation.pdf'
        if not pdf_path.exists():
            raise HTTPException(status_code=422, detail='PDF not produced by LibreOffice')

        slide_prefix = str(tmp_dir / 'slide')
        pp_proc = await asyncio.create_subprocess_exec(
            'pdftoppm', '-png', '-r', '120', str(pdf_path), slide_prefix,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, pp_stderr = await pp_proc.communicate()
        if pp_proc.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f'pdftoppm failed: {pp_stderr.decode(errors="replace")}',
            )

        png_files = sorted(tmp_dir.glob('slide-*.png'))
        slides = [base64.b64encode(f.read_bytes()).decode('ascii') for f in png_files]

        logger.info('[CLAUDE-SERVICE] pptx-preview artifactId=%s slides=%d', body.artifactId, len(slides))
        return {'slides': slides, 'count': len(slides)}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post('/create-xlsx')
async def create_xlsx(request: Request, body: CreateXlsxRequest):
    verify_auth(request)

    output_dir = Path(tempfile.mkdtemp(prefix='xlsx-'))
    output_path = output_dir / 'spreadsheet.xlsx'

    try:
        logger.info('[CLAUDE-SERVICE] create-xlsx title=%r', body.title[:60])

        skill_prompt = load_skill('xlsx')
        prompt = (
            f'{skill_prompt}\n\n'
            f'---\n\n'
            f'## Task\n\n'
            f'Create a spreadsheet from the following content.\n\n'
            f'Title: {body.title}\n\n'
            f'Content:\n{body.content}\n\n'
            f'Write the complete file to: {output_path}\n'
            f'Print `DONE: {output_path}` when complete.\n'
        )

        options = ClaudeAgentOptions(
            tools=['Bash'],
            allowed_tools=['Bash'],
            model=body.model_id,
            env=agent_env(body.user_id, body.chat_message_id),
        )

        if body.job_id:
            await post_event(body.job_id, {'type': 'subagent_progress', 'label': 'Building spreadsheet...'})

        source_script: str | None = None
        gen_step = 0
        pending_tool_calls: dict[str, dict] = {}
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        gen_step += 1
                        raw_input = block.input if isinstance(block.input, dict) else {}
                        pending_tool_calls[block.id] = {'tool': block.name, 'step': gen_step}
                        if block.name == 'Bash' and isinstance(raw_input, dict):
                            cmd = raw_input.get('command', '')
                            if 'openpyxl' in cmd or 'workbook' in cmd.lower() or '.xlsx' in cmd:
                                source_script = cmd
                        if body.job_id:
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_call',
                                'tool': block.name,
                                'args': _sanitize_tool_args(block.name, raw_input),
                                'step': gen_step,
                            })
                    elif isinstance(block, ThinkingBlock) and body.job_id:
                        await post_event(body.job_id, {
                            'type': 'subagent_thinking',
                            'step': gen_step,
                            'length': len(block.thinking),
                        })
            elif isinstance(message, UserMessage) and body.job_id:
                if isinstance(message.content, list):
                    for block in message.content:
                        if isinstance(block, ToolResultBlock):
                            call_info = pending_tool_calls.pop(block.tool_use_id, None)
                            content_len = len(block.content) if isinstance(block.content, str) else 0
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_result',
                                'tool': call_info['tool'] if call_info else 'unknown',
                                'step': call_info['step'] if call_info else gen_step,
                                'contentLength': content_len,
                                'isError': block.is_error or False,
                            })
            elif isinstance(message, ResultMessage) and body.job_id:
                await post_event(body.job_id, {
                    'type': 'subagent_complete',
                    'label': 'Spreadsheet generation complete',
                    'durationMs': message.duration_ms,
                })

        if not output_path.exists():
            raise HTTPException(status_code=422, detail='Spreadsheet generation failed — agent did not produce a file')

        raw = output_path.read_bytes()
        content = base64.b64encode(raw).decode('ascii')

        return {
            'artifacts': {
                'content': content,
                'extension': '.xlsx',
                'encoding': 'base64',
            },
            'source_script': source_script,
        }
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


@router.post('/edit-xlsx')
async def edit_xlsx(request: Request, body: EditXlsxRequest):
    verify_auth(request)

    output_dir = Path(tempfile.mkdtemp(prefix='xlsx-edit-'))
    raw_suffix = Path(body.filename).suffix.lower() if body.filename else '.xlsx'
    input_suffix = raw_suffix if raw_suffix in ('.xlsx', '.csv') else '.xlsx'
    is_csv_input = input_suffix == '.csv'
    extension = '.csv' if is_csv_input else '.xlsx'
    output_filename = f'spreadsheet{extension}'
    output_path = output_dir / output_filename

    try:
        logger.info('[CLAUDE-SERVICE] edit-xlsx title=%r changes=%r', body.title[:60], body.changes[:120])

        skill_prompt = load_skill('xlsx')

        if body.data_b64:
            # Path B — uploaded file: write raw data to disk and have the subagent manipulate it directly
            input_path = output_dir / f'input{input_suffix}'
            input_path.write_bytes(base64.b64decode(body.data_b64))
            output_format_note = 'Save the result as a CSV file (.csv).' if is_csv_input else 'Save the result as an Excel file (.xlsx).'
            prompt = (
                f'{skill_prompt}\n\n'
                f'---\n\n'
                f'## Task\n\n'
                f'Edit the uploaded spreadsheet by applying the requested changes.\n\n'
                f'Input file: {input_path}\n'
                f'Requested changes:\n{body.changes}\n\n'
                f'Load the input file, apply the changes, then {output_format_note}\n'
                f'Write the complete file to: {output_path}\n'
                f'Print `DONE: {output_path}` when complete.\n'
            )
        else:
            # Path A — generated artifact: rewrite the source script
            prompt = (
                f'{skill_prompt}\n\n'
                f'---\n\n'
                f'## Task\n\n'
                f'Edit the existing spreadsheet by applying the requested changes to the script below.\n\n'
                f'Title: {body.title}\n\n'
                f'Requested changes:\n{body.changes}\n\n'
                f'Existing script:\n```python\n{body.source_script}\n```\n\n'
                f'Rewrite the script incorporating the changes, then execute it to produce the updated file.\n'
                f'Write the complete file to: {output_path}\n'
                f'Print `DONE: {output_path}` when complete.\n'
            )

        options = ClaudeAgentOptions(
            tools=['Bash'],
            allowed_tools=['Bash'],
            model=body.model_id,
            env=agent_env(body.user_id, body.chat_message_id),
        )

        if body.job_id:
            await post_event(body.job_id, {'type': 'subagent_progress', 'label': 'Applying edits to spreadsheet...'})

        source_script: str | None = None
        gen_step = 0
        pending_tool_calls: dict[str, dict] = {}
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, ToolUseBlock):
                        gen_step += 1
                        raw_input = block.input if isinstance(block.input, dict) else {}
                        pending_tool_calls[block.id] = {'tool': block.name, 'step': gen_step}
                        if block.name == 'Bash' and isinstance(raw_input, dict):
                            cmd = raw_input.get('command', '')
                            if 'openpyxl' in cmd or 'workbook' in cmd.lower() or '.xlsx' in cmd:
                                source_script = cmd
                        if body.job_id:
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_call',
                                'tool': block.name,
                                'args': _sanitize_tool_args(block.name, raw_input),
                                'step': gen_step,
                            })
                    elif isinstance(block, ThinkingBlock) and body.job_id:
                        await post_event(body.job_id, {
                            'type': 'subagent_thinking',
                            'step': gen_step,
                            'length': len(block.thinking),
                        })
            elif isinstance(message, UserMessage) and body.job_id:
                if isinstance(message.content, list):
                    for block in message.content:
                        if isinstance(block, ToolResultBlock):
                            call_info = pending_tool_calls.pop(block.tool_use_id, None)
                            content_len = len(block.content) if isinstance(block.content, str) else 0
                            await post_event(body.job_id, {
                                'type': 'subagent_tool_result',
                                'tool': call_info['tool'] if call_info else 'unknown',
                                'step': call_info['step'] if call_info else gen_step,
                                'contentLength': content_len,
                                'isError': block.is_error or False,
                            })
            elif isinstance(message, ResultMessage) and body.job_id:
                await post_event(body.job_id, {
                    'type': 'subagent_complete',
                    'label': 'Spreadsheet edit complete',
                    'durationMs': message.duration_ms,
                })

        if not output_path.exists():
            raise HTTPException(status_code=422, detail='Spreadsheet edit failed — agent did not produce a file')

        if is_csv_input:
            content = output_path.read_text(encoding='utf-8')
            encoding = 'utf-8'
        else:
            content = base64.b64encode(output_path.read_bytes()).decode('ascii')
            encoding = 'base64'

        return {
            'artifacts': {
                'content': content,
                'extension': extension,
                'encoding': encoding,
            },
            'source_script': source_script,
        }
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


@router.post('/create-mp4')
async def create_mp4(request: Request, body: CreateMp4Request):
    verify_auth(request)

    job_id = body.job_id or os.urandom(8).hex()
    output_dir = Path(tempfile.mkdtemp(prefix='mp4-'))
    output_path = output_dir / 'video.mp4'

    try:
        logger.info('[CLAUDE-SERVICE] create-mp4 title=%r', body.title[:60])

        result = await _run_agent_skill(
            skill_name='video',
            output_type='video',
            output_path=output_path,
            model_id=body.model_id,
            user_id=body.user_id,
            chat_message_id=body.chat_message_id,
            title=body.title,
            content=body.content,
            style=body.style,
            feedback=body.feedback,
            job_id=body.job_id,
        )

        if not output_path.exists():
            raise HTTPException(status_code=422, detail='Video generation failed')

        content = output_path.read_text(encoding='utf-8')

        return {'artifacts': {
            'content': content,
            'extension': '.mp4',
            'encoding': 'utf-8',
        }}
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


async def _run_agent_skill(
    skill_name: str,
    output_type: str,
    output_path: Path,
    model_id: str,
    user_id: str,
    chat_message_id: str | None,
    title: str,
    content: str,
    style: str,
    feedback: str,
    job_id: str | None,
) -> None:
    if job_id:
        await post_event(job_id, {
            'type': 'subagent_progress',
            'label': f'Loading {output_type} skill...',
        })

    skill_prompt = load_skill(skill_name)
    effective_style = style if style and style != 'default' else 'corporate-minimal'
    style_hint = f'\nDesign style preference: {effective_style}\n'

    feedback_hint = ''
    if feedback:
        feedback_hint = f'\nFeedback on previous version (apply these changes):\n{feedback}\n'

    prompt = (
        f'{skill_prompt}\n\n'
        f'---\n\n'
        f'## Task\n\n'
        f'Generate a {output_type} from the following content.\n'
        f'{style_hint}'
        f'{feedback_hint}'
        f'\nTitle: {title}\n\n'
        f'Content:\n{content}\n\n'
        f'Write the complete file to: {output_path}\n'
    )

    options = ClaudeAgentOptions(
        tools=['Bash'],
        allowed_tools=['Bash'],
        model=model_id,
        env=agent_env(user_id, chat_message_id),
    )

    if job_id:
        await post_event(job_id, {
            'type': 'subagent_progress',
            'label': f'Generating {output_type}...',
        })

    gen_step = 0
    pending_tool_calls: dict[str, dict] = {}
    async for message in query(prompt=prompt, options=options):
        if not job_id:
            continue
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, ToolUseBlock):
                    gen_step += 1
                    raw_input = block.input if isinstance(block.input, dict) else {}
                    pending_tool_calls[block.id] = {'tool': block.name, 'step': gen_step}
                    await post_event(job_id, {
                        'type': 'subagent_tool_call',
                        'tool': block.name,
                        'args': _sanitize_tool_args(block.name, raw_input),
                        'step': gen_step,
                    })
                elif isinstance(block, ThinkingBlock):
                    await post_event(job_id, {
                        'type': 'subagent_thinking',
                        'step': gen_step,
                        'length': len(block.thinking),
                    })
        elif isinstance(message, UserMessage):
            if isinstance(message.content, list):
                for block in message.content:
                    if isinstance(block, ToolResultBlock):
                        call_info = pending_tool_calls.pop(block.tool_use_id, None)
                        content_len = len(block.content) if isinstance(block.content, str) else 0
                        await post_event(job_id, {
                            'type': 'subagent_tool_result',
                            'tool': call_info['tool'] if call_info else 'unknown',
                            'step': call_info['step'] if call_info else gen_step,
                            'contentLength': content_len,
                            'isError': block.is_error or False,
                        })
        elif isinstance(message, ResultMessage):
            await post_event(job_id, {
                'type': 'subagent_complete',
                'label': f'{output_type.capitalize()} generation complete',
                'durationMs': message.duration_ms,
            })


def _sanitize_tool_args(tool_name: str, raw_input: dict) -> dict:
    if tool_name == 'Bash':
        return {'command': raw_input.get('command', '')}
    if tool_name == 'Write':
        return {'file_path': raw_input.get('file_path', '')}
    if tool_name == 'Read':
        return {'file_path': raw_input.get('file_path', '')}
    if tool_name == 'Edit':
        return {'file_path': raw_input.get('file_path', '')}
    return {k: str(v) for k, v in list(raw_input.items())[:5]}
