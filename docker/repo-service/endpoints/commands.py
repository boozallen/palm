import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lib.paths import ensure_repo
from lib.sources import load_command_sources

router = APIRouter()


class CommandLoadRequest(BaseModel):
    repo_id: str
    command: str
    user_input: str = ''


@router.get('/repos/{repo_id}/commands')
async def list_commands(repo_id: str):
    repo_dir = ensure_repo(repo_id)
    commands_dir = repo_dir / '.claude' / 'commands'

    if not commands_dir.exists():
        return {'commands': []}

    commands = []
    for cmd_file in sorted(commands_dir.glob('*.md')):
        content = cmd_file.read_text()
        description = ''

        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 2:
                for line in parts[1].split('\n'):
                    if line.lower().startswith('description:'):
                        description = line.split(':', 1)[1].strip()
                        break

        commands.append({
            'command': cmd_file.stem,
            'description': description,
        })

    return {'commands': commands}


@router.post('/repos/{repo_id}/commands/load')
async def load_command(repo_id: str, req: CommandLoadRequest):
    repo_dir = ensure_repo(repo_id)
    commands_dir = repo_dir / '.claude' / 'commands'
    commands_real = os.path.realpath(str(commands_dir))

    command_real = os.path.realpath(os.path.join(commands_real, f'{req.command}.md'))
    if not command_real.startswith(commands_real):
        raise HTTPException(status_code=403, detail='Path traversal not allowed')

    if not os.path.exists(command_real):
        available = [f.stem for f in commands_dir.glob('*.md')] if commands_dir.exists() else []
        raise HTTPException(
            status_code=404,
            detail=f'Command not found: {req.command}. Available: {", ".join(available)}',
        )

    with open(command_real) as f:
        command_content = f.read()

    command_instructions = command_content
    if command_content.startswith('---'):
        parts = command_content.split('---', 2)
        if len(parts) >= 3:
            command_instructions = parts[2].strip()

    sources = load_command_sources(repo_dir, req.command, command_content)

    return {
        'command': req.command,
        'instructions': command_instructions,
        'sources': sources,
        'user_input': req.user_input,
    }
