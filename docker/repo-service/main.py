"""
Skill Repo Service

Hosts local clones of skill repositories (agent-accessible knowledge bases)
and exposes read-only HTTP endpoints for file access, search, and command loading.
"""
import logging

from fastapi import FastAPI

from lib.paths import REPOS_ROOT
from endpoints.refresh import router as refresh_router
from endpoints.commands import router as commands_router
from endpoints.files import router as files_router
from endpoints.search import router as search_router
from endpoints.meta import router as meta_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title='Skill Repo Service')

app.include_router(refresh_router)
app.include_router(commands_router)
app.include_router(files_router)
app.include_router(search_router)
app.include_router(meta_router)


@app.get('/health')
async def health():
    repos = []
    if REPOS_ROOT.exists():
        for entry in sorted(REPOS_ROOT.iterdir()):
            if (entry / '.git').exists():
                commands_dir = entry / '.claude' / 'commands'
                command_count = len(list(commands_dir.glob('*.md'))) if commands_dir.exists() else 0
                repos.append({
                    'id': entry.name,
                    'commands_available': commands_dir.exists(),
                    'command_count': command_count,
                })

    return {
        'status': 'healthy' if repos else 'idle',
        'repos': repos,
        'repo_count': len(repos),
    }
