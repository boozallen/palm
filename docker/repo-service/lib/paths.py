import os
from pathlib import Path

from fastapi import HTTPException

REPOS_ROOT = Path('/repos')
REPOS_ROOT.mkdir(parents=True, exist_ok=True)
REPOS_ROOT_REAL = os.path.realpath(str(REPOS_ROOT))


def repo_path(repo_id: str) -> Path:
    if not repo_id or '/' in repo_id or '..' in repo_id:
        raise HTTPException(status_code=400, detail='Invalid repo_id')
    candidate = os.path.realpath(os.path.join(REPOS_ROOT_REAL, repo_id))
    if not candidate.startswith(REPOS_ROOT_REAL):
        raise HTTPException(status_code=400, detail='Invalid repo_id')
    return Path(candidate)



def ensure_repo(repo_id: str) -> Path:
    path = repo_path(repo_id)
    if not (path / '.git').exists():
        raise HTTPException(status_code=404, detail=f'Repo not cloned: {repo_id}')
    return path
