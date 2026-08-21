import os

from fastapi import APIRouter

from lib.paths import ensure_repo

router = APIRouter()


@router.get('/repos/{repo_id}/meta')
async def get_repo_meta(repo_id: str):
    repo_dir = ensure_repo(repo_id)
    repo_real = os.path.realpath(str(repo_dir))

    description = ''
    for candidate in ['CLAUDE.md', 'README.md']:
        meta_real = os.path.realpath(os.path.join(repo_real, candidate))
        if not meta_real.startswith(repo_real):
            continue
        if not os.path.exists(meta_real):
            continue
        with open(meta_real) as f:
            content = f.read()
        lines = content.split('\n')
        para_lines = []
        for line in lines:
            if line.startswith('#'):
                if para_lines:
                    break
                continue
            if line.strip():
                para_lines.append(line.strip())
            elif para_lines:
                break
        if para_lines:
            description = ' '.join(para_lines)[:500]
            break

    commands_dir = repo_dir / '.claude' / 'commands'
    command_names = sorted(f.stem for f in commands_dir.glob('*.md')) if commands_dir.exists() else []

    return {
        'repo_id': repo_id,
        'description': description,
        'has_commands': len(command_names) > 0,
        'command_count': len(command_names),
        'commands': command_names,
    }
