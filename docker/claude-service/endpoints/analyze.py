import base64
import io
import logging
import re
import tempfile
import time
from typing import Any

import numpy as np
import pandas as pd
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage, ToolUseBlock, UserMessage
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from lib.agent_env import agent_env
from lib.auth import verify_auth
from lib.job_progress import post_event

logger = logging.getLogger(__name__)

router = APIRouter()


def _agent_options(
    model_id: str,
    user_id: str,
    chat_message_id: str | None,
    user_group_id: str | None = None,
) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        tools=['Bash'],
        allowed_tools=['Bash'],
        model=model_id,
        env=agent_env(user_id, chat_message_id, user_group_id),
    )


class GetSchemaRequest(BaseModel):
    data_b64: str
    filename: str


class AnalyzeRequest(BaseModel):
    model_id: str
    user_id: str
    chat_message_id: str | None = None
    user_group_id: str | None = None
    question: str
    filename: str
    data_b64: str
    data_profile: dict | None = None
    job_id: str | None = None


_ALLOWED_SUFFIXES = {'csv': '.csv', 'xlsx': '.xlsx', 'xls': '.xls'}
_SHEET_MARKER = re.compile(r'^=== Sheet name: (.+?) ===$', re.MULTILINE)


def _file_suffix(filename: str) -> str:
    raw = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    return _ALLOWED_SUFFIXES.get(raw, '.csv')


def _describe_df(df: Any) -> dict[str, Any]:
    columns = []
    row_count = int(len(df))
    for col in df.columns:
        info: dict[str, Any] = {'name': str(col), 'dtype': str(df[col].dtype)}
        if pd.api.types.is_numeric_dtype(df[col]):
            col_min = df[col].min()
            col_max = df[col].max()
            info['min'] = None if pd.isna(col_min) else float(col_min)
            info['max'] = None if pd.isna(col_max) else float(col_max)
        else:
            uniq = df[col].dropna().unique().tolist()
            info['uniqueValues'] = [str(v) for v in uniq[:20]]
        columns.append(info)
    return {
        'rowCount': row_count,
        'columnCount': int(len(df.columns)),
        'columns': columns,
    }


def _normalize_to_xlsx(file_data: bytes, filename: str) -> tuple[bytes, str]:
    raw = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if raw not in ('xlsx', 'xls'):
        return file_data, filename

    if file_data[:2] == b'PK':
        return file_data, filename

    try:
        text = file_data.decode('utf-8', errors='replace')
        parts = _SHEET_MARKER.split(text)
        sheets: dict[str, pd.DataFrame] = {}
        if len(parts) >= 3:
            for i in range(1, len(parts) - 1, 2):
                sheet_name = parts[i].strip()
                sheet_csv = parts[i + 1].lstrip('\n')
                sheets[sheet_name] = pd.read_csv(io.StringIO(sheet_csv))
        else:
            sheets['Sheet1'] = pd.read_csv(io.StringIO(text))

        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine='openpyxl') as writer:
            for sheet_name, df in sheets.items():
                df.to_excel(writer, sheet_name=sheet_name, index=False)
        return buf.getvalue(), filename
    except Exception as exc:
        logger.warning('[CLAUDE-SERVICE] xlsx reconstruction failed, falling back to csv: %s', exc)
        return file_data, filename.rsplit('.', 1)[0] + '.csv'


def _summarize_bash(command: str, step: int) -> str | None:
    skip_prefixes = (
        'import ', 'from ', '#', 'print(', 'pd.set_option', 'np.', 'logging',
        'logger', 'python3', 'EOF', 'PYEOF', 'python ', 'warnings.',
        'df = pd.read_csv(', 'df = pd.read_excel(', 'df = pd.read_',
        'df.columns', 'df.dtypes', 'df.head(', 'df.shape', 'df.info(',
        'cat > ', 'cat>',
    )
    lines = command.splitlines()
    for i, line in enumerate(lines):
        if '<<' in line and 'EOF' in line:
            lines = lines[i + 1:]
            break
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line == 'EOF' or any(line.startswith(p) for p in skip_prefixes):
            continue
        return f'Analyst agent: {line}'
    return None


@router.post('/get-schema')
async def get_schema(request: Request, body: GetSchemaRequest):
    verify_auth(request)
    file_data = base64.b64decode(body.data_b64)
    try:
        ext = _file_suffix(body.filename).lstrip('.')
        if ext in ('xlsx', 'xls'):
            sheets = {}
            xls = pd.ExcelFile(io.BytesIO(file_data))
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(io.BytesIO(file_data), sheet_name=sheet_name)
                sheets[sheet_name] = _describe_df(df)
        else:
            df = pd.read_csv(io.BytesIO(file_data))
            sheets = {'Sheet1': _describe_df(df)}
        result = {'filename': body.filename, 'sheets': sheets}
        logger.info('[CLAUDE-SERVICE] get-schema filename=%s sheets=%s', body.filename, list(sheets.keys()))
        return {'success': True, 'profile': result}
    except Exception as exc:
        logger.warning('[CLAUDE-SERVICE] get-schema failed filename=%s error=%s', body.filename, exc)
        return {'success': False, 'error': 'Failed to profile document'}


@router.post('/analyze')
async def analyze(request: Request, body: AnalyzeRequest):
    verify_auth(request)

    file_data = base64.b64decode(body.data_b64)
    file_data, effective_filename = _normalize_to_xlsx(file_data, body.filename)

    with tempfile.NamedTemporaryFile(suffix=_file_suffix(effective_filename), delete=False) as f:
        f.write(file_data)
        tmp_path = f.name

    logger.info('[CLAUDE-SERVICE] analyze filename=%s question=%r', body.filename, body.question[:80])

    ext = _file_suffix(effective_filename).lstrip('.')

    schema_hint = ''
    if body.data_profile:
        sheets = body.data_profile.get('sheets', {})
        col_blocks = []
        for sheet_name, sheet_info in sheets.items():
            if isinstance(sheet_info, dict):
                col_lines = [f'  {col["name"]} ({col["dtype"]})' for col in sheet_info.get('columns', [])]
                if col_lines:
                    if len(sheets) > 1:
                        col_blocks.append(f'Sheet "{sheet_name}":\n' + '\n'.join(col_lines))
                    else:
                        col_blocks.append('\n'.join(col_lines))
        if col_blocks:
            schema_hint = 'Known columns (do not explore the file structure, go straight to computation):\n' + '\n'.join(col_blocks) + '\n\n'

    prompt = (
        f'You are a data analysis specialist. Use the Bash tool to run Python pandas code to answer this question.\n\n'
        f'IMPORTANT: Always write Python code to a file and execute it. Never use python3 -c or inline one-liners.\n'
        f'Use this pattern:\n'
        f'cat > /tmp/analysis.py << \'PYEOF\'\n'
        f'import pandas as pd\n'
        f'# your code here\n'
        f'PYEOF\n'
        f'python3 /tmp/analysis.py\n\n'
        f'File: {tmp_path} ({ext})\n\n'
        f'{schema_hint}'
        f'Question: {body.question}\n\n'
        f'Instructions:\n'
        f'1. Load ALL rows by default.\n'
        f'2. If the question uses words like "actual", "plan", "budget", or "planned" and the data has '
        f'a column that distinguishes these (e.g. AorP, Type, Category), filter to the matching rows.\n'
        f'3. Other column names or values that resemble words in the question are NOT filter instructions — do not filter on them.\n'
        f'   If the data has a "Profit" column, use it directly rather than computing revenue minus cost.\n'
        f'   Profit margin = Profit / Revenue * 100.\n'
        f'4. For trend or time-series questions: group ONLY by the single time/date column. '
        f'Do not add any other grouping columns unless the question explicitly asks for a breakdown '
        f'by a second dimension (e.g. "by market by month"). Summing across all rows for each period '
        f'is the correct default — do not sub-group.\n'
        f'Never use cumsum(), rolling(), diff(), or pct_change() unless the user explicitly asks for '
        f'running totals, rolling averages, or period-over-period changes. '
        f'If the user asks for period-over-period changes alongside the raw values, compute them '
        f'as a separate column AFTER you have the correct per-period totals: '
        f'`result["MoM"] = result["value_col"].diff()`.\n'
        f'Always verify your filter is correct by printing the filtered row count and '
        f'the unique values of any column you filtered on before computing final results.\n'
        f'5. Print the computed result formatted as markdown:\n'
        f'   - Tabular data: use df.to_markdown(index=False)\n'
        f'     * If a "Key" column is present and all its values are numeric, drop it (it is a row index artifact). Otherwise keep it as-is.\n'
        f'     * Format all currency/dollar columns with commas and 2 decimal places (e.g. 1234567.89 → 1,234,567.89) — never use scientific notation\n'
        f'     * Format percentage columns to 1 decimal place\n'
        f'     * Apply formatting by converting columns to strings before calling to_markdown()\n'
        f'   - Lists/series: use a markdown bullet list\n'
        f'   - Single values: plain text is fine\n'
        f'   Print only the formatted result — no extra commentary.'
    )

    options = _agent_options(body.model_id, body.user_id, body.chat_message_id, body.user_group_id)

    answer = ''
    all_bash_outputs: list[str] = []
    code_used = None
    step = 0
    _start_ms = time.perf_counter()
    async for message in query(prompt=prompt, options=options):
        if isinstance(message, ResultMessage) and message.result:
            answer = message.result
        elif isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, ToolUseBlock) and block.name == 'Bash':
                    raw_input = block.input
                    if isinstance(raw_input, dict):
                        code_used = raw_input.get('command', '')
                    elif isinstance(raw_input, str):
                        code_used = raw_input
                    step += 1
                    if body.job_id:
                        label = _summarize_bash(code_used, step)
                        if label:
                            await post_event(body.job_id, {
                                'type': 'subagent_progress',
                                'label': label,
                            })
        elif isinstance(message, UserMessage) and message.tool_use_result:
            raw = message.tool_use_result
            if isinstance(raw, str):
                result_content = raw
            elif isinstance(raw, dict):
                result_content = raw.get('content', '')
            else:
                result_content = ''
            if isinstance(result_content, list):
                chunk = '\n'.join(
                    c.get('text', '') if isinstance(c, dict) else str(c)
                    for c in result_content
                ).strip()
            elif isinstance(result_content, str):
                chunk = result_content.strip()
            else:
                chunk = ''
            if chunk and not chunk.startswith('Error:'):
                all_bash_outputs.append(chunk)

    bash_stdout = '\n\n'.join(all_bash_outputs)
    if bash_stdout:
        answer = bash_stdout
    if not answer:
        raise HTTPException(status_code=422, detail='Agent did not produce an answer')

    if body.job_id:
        await post_event(body.job_id, {'type': 'subagent_progress', 'label': 'Analyst agent: Writing analysis...'})
    interpretation_prompt = (
        f'Question asked: {body.question}\n\n'
        f'Verified data output from pandas (this is complete and correct — do not request more data):\n\n'
        f'{answer}\n\n'
        f'Write a markdown response that includes:\n'
        f'1. The data above exactly as-is (copy it verbatim)\n'
        f'2. A brief plain-English summary below it\n'
        f'Do not rename, paraphrase, or omit any values. Do not ask for more data.'
    )
    interpretation_options = _agent_options(body.model_id, body.user_id, body.chat_message_id, body.user_group_id)
    interpreted = ''
    async for message in query(prompt=interpretation_prompt, options=interpretation_options):
        if isinstance(message, ResultMessage) and message.result:
            interpreted = message.result
    if interpreted:
        answer = interpreted

    if body.job_id:
        duration_ms = int((time.perf_counter() - _start_ms) * 1000)
        await post_event(body.job_id, {
            'type': 'subagent_complete',
            'label': 'Analysis complete',
            'durationMs': duration_ms,
        })

    logger.info('[CLAUDE-SERVICE] analyze complete answer=%s', answer[:100])
    return {'answer': answer, 'code': code_used}
