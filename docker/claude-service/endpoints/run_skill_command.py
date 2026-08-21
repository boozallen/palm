import logging

from claude_agent_sdk import (
    query, ClaudeAgentOptions, AssistantMessage, ResultMessage,
    ToolUseBlock, ToolResultBlock, ThinkingBlock, TextBlock, UserMessage,
)
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from lib.agent_env import agent_env
from lib.auth import verify_auth
from lib.job_progress import post_event

logger = logging.getLogger(__name__)

router = APIRouter()


class RunSkillCommandRequest(BaseModel):
    model_id: str
    user_id: str
    chat_message_id: str | None = None
    command: str
    instructions: str
    sources: str = ''
    document_content: str = ''
    user_input: str = ''
    job_id: str | None = None
    repo_id: str = ''


@router.post('/run-skill-command')
async def run_skill_command(request: Request, body: RunSkillCommandRequest):
    verify_auth(request)

    logger.info('[CLAUDE-SERVICE] run-skill-command command=%s model=%s sources_len=%d doc_len=%d',
                body.command, body.model_id, len(body.sources), len(body.document_content))

    repo_path = f'/repos/{body.repo_id}' if body.repo_id else ''

    prompt_parts = [
        f'You are executing the /{body.command} command.\n\n',
        f'## Command Instructions\n\n{body.instructions}\n\n',
    ]

    if body.user_input:
        prompt_parts.append(f'## User Request\n\n{body.user_input}\n\n')

    if body.document_content:
        prompt_parts.append(f'## Attached Document Content\n\n{body.document_content}\n\n')

    if repo_path:
        prompt_parts.append(
            f'## Source Repository\n\n'
            f'The skill repo is available at: {repo_path}\n\n'
            f'MANDATORY: You MUST use the Read tool to load source files BEFORE writing each '
            f'section. The command instructions reference specific file paths — read those files '
            f'and cite the specific names, metrics, programs, and data points you find. '
            f'Do NOT write any section without first reading the relevant source files. '
            f'Use Bash with grep/find to search for specific evidence when you need to locate '
            f'content across multiple files. Read files one at a time as you draft each section — '
            f'do NOT skip this step or claim you have "enough context" from the prompt alone.\n\n'
            f'The filesystem is READ-ONLY. Do NOT attempt to create directories or write files. '
            f'Your job is to READ source files and produce text output — nothing else.\n\n'
            f'NEVER read the same file twice. If a file is too large to fit in one read, '
            f'extract what you need from what you received and move on. Do NOT loop.\n\n'
        )
    elif body.sources:
        prompt_parts.append(f'## Source Files\n\n{body.sources}\n\n')

    prompt_parts.append(
        '## Output Instructions\n\n'
        'Follow the command instructions above completely. '
        'Write the final output as markdown. Do NOT ask clarifying questions — '
        'use reasonable defaults for any missing context. '
        'Do NOT echo the methodology — internalize it and produce the artifact directly. '
        'Do NOT narrate what you are doing ("I\'ll execute...", "Let me work through...", '
        '"Read-only filesystem...", "I have enough context..."). '
        'Do NOT output intermediate analysis, approach proposals, or planning steps. '
        'The user has already approved the approach. '
        'Your final text output must be ONLY the artifact content — start with the frontmatter '
        'or first heading. No preamble, no narration, no explanation before or after.\n\n'
        'FORMAT COMPLIANCE: Your output format MUST match EXACTLY what the command instructions '
        'specify. If the instructions say to use blockquotes (>), use blockquotes. If they say '
        'to include proof points, win themes, or evaluation footers after each section, include '
        'them. If they specify a self-eval rubric, run it and include the scorecard. Do NOT '
        'simplify, omit, or restructure the output format. The command instructions are the '
        'format authority — follow their structure precisely.\n\n'
        'COMPLETENESS: You MUST complete ALL sections specified in the command instructions. '
        'Do NOT stop early. Do NOT summarize remaining sections. Write every single section '
        'in full. If the instructions say 7 sections, you write 7 complete sections. '
        'Stopping before all sections are written is a failure.\n\n'
        'EVIDENCE GROUNDING: The source files are your evidence library. When you make a '
        'claim, cite the specific names, numbers, and examples from the sources. Do not '
        'paraphrase evidence generically — use the actual data points the sources provide.\n\n'
        'PHASE CHECKLIST: At the very end of your output, include:\n'
        '<!-- PHASES COMPLETED\n'
        '- [x] or [ ] Phase N: description\n'
        '(for all phases in the instructions)\n'
        '-->'
    )

    prompt = ''.join(prompt_parts)

    if repo_path:
        options = ClaudeAgentOptions(
            model=body.model_id,
            permission_mode='bypassPermissions',
            allowed_tools=['Read', 'Bash'],
            disallowed_tools=['Agent', 'TaskCreate', 'TaskOutput', 'TaskUpdate', 'Workflow', 'Write', 'Edit', 'NotebookEdit'],
            cwd=repo_path,
            max_turns=100,
            env=agent_env(body.user_id, body.chat_message_id),
        )
    else:
        options = ClaudeAgentOptions(
            tools=[],
            allowed_tools=[],
            model=body.model_id,
            env=agent_env(body.user_id, body.chat_message_id),
        )

    result_text = ''
    last_assistant_text = ''
    step = 0
    pending_tool_calls: dict[str, dict] = {}

    async for message in query(prompt=prompt, options=options):
        if isinstance(message, ResultMessage) and message.result:
            result_text = message.result
            logger.info('[CLAUDE-SERVICE] ResultMessage len=%d', len(message.result))
            await post_event(body.job_id, {
                'type': 'subagent_complete',
                'durationMs': message.duration_ms,
                'numTurns': message.num_turns,
                'totalCostUsd': message.total_cost_usd,
                'usage': message.usage,
            })

        elif isinstance(message, AssistantMessage):
            text_parts = []
            for block in message.content:
                if isinstance(block, ToolUseBlock):
                    step += 1
                    raw_input = block.input if isinstance(block.input, dict) else {}
                    tool_arg = raw_input.get('command') or raw_input.get('file_path') or ''
                    logger.info('[CLAUDE-SERVICE] skill-agent step=%d tool=%s arg=%s',
                                step, block.name, str(tool_arg)[:200])
                    pending_tool_calls[block.id] = {'tool': block.name, 'step': step}
                    await post_event(body.job_id, {
                        'type': 'subagent_tool_call',
                        'tool': block.name,
                        'args': _sanitize_args(block.name, raw_input),
                        'step': step,
                    })

                elif isinstance(block, ThinkingBlock):
                    await post_event(body.job_id, {
                        'type': 'subagent_thinking',
                        'step': step,
                        'length': len(block.thinking),
                    })

                elif isinstance(block, TextBlock) and block.text:
                    text_parts.append(block.text)

            if text_parts:
                last_assistant_text = '\n'.join(text_parts)
                logger.info('[CLAUDE-SERVICE] AssistantMessage text len=%d', len(last_assistant_text))
                await post_event(body.job_id, {
                    'type': 'subagent_text',
                    'step': step,
                    'length': len(last_assistant_text),
                })

        elif isinstance(message, UserMessage):
            if isinstance(message.content, list):
                for block in message.content:
                    if isinstance(block, ToolResultBlock):
                        call_info = pending_tool_calls.pop(block.tool_use_id, None)
                        content_len = len(block.content) if isinstance(block.content, str) else 0
                        await post_event(body.job_id, {
                            'type': 'subagent_tool_result',
                            'tool': call_info['tool'] if call_info else 'unknown',
                            'step': call_info['step'] if call_info else step,
                            'contentLength': content_len,
                            'isError': block.is_error or False,
                        })

    if not result_text and last_assistant_text:
        logger.info('[CLAUDE-SERVICE] No ResultMessage, using last AssistantMessage text')
        result_text = last_assistant_text

    if not result_text:
        raise HTTPException(status_code=422, detail='Agent did not produce output')

    logger.info('[CLAUDE-SERVICE] run-skill-command complete command=%s output_len=%d', body.command, len(result_text))
    logger.info('[CLAUDE-SERVICE] run-skill-command output_start: %s', result_text[:500])
    logger.info('[CLAUDE-SERVICE] run-skill-command output_end: %s', result_text[-500:])
    return {'output': result_text}


def _sanitize_args(tool_name: str, raw_input: dict) -> dict:
    if tool_name == 'Read':
        return {'file_path': raw_input.get('file_path', '')}
    if tool_name == 'Bash':
        cmd = raw_input.get('command', '')
        return {'command': cmd[:200]}
    if tool_name == 'Grep':
        return {
            'pattern': raw_input.get('pattern', ''),
            'path': raw_input.get('path', ''),
        }
    return {k: str(v)[:100] for k, v in list(raw_input.items())[:5]}
