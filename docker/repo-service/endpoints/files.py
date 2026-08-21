import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lib.paths import ensure_repo

logger = logging.getLogger(__name__)
router = APIRouter()


class FileReadRequest(BaseModel):
    repo_id: str
    path: str


@router.get('/repos/{repo_id}/files')
async def list_files(repo_id: str, path: str = ''):
    repo_dir = ensure_repo(repo_id)
    repo_real = os.path.realpath(str(repo_dir))

    if path:
        search_path_real = os.path.realpath(os.path.join(repo_real, path))
        if not search_path_real.startswith(repo_real):
            raise HTTPException(status_code=403, detail='Path traversal not allowed')
        search_path = search_path_real
    else:
        search_path = repo_real

    if not os.path.exists(search_path):
        raise HTTPException(status_code=404, detail=f'Path not found: {path}')

    from pathlib import Path as P
    search_p = P(search_path)
    files = [str(f.relative_to(repo_dir)) for f in sorted(search_p.rglob('*.md'))]
    if len(files) > 500:
        return {'files': files[:500], 'count': len(files), 'truncated': True}

    return {'files': files, 'count': len(files)}


@router.post('/repos/{repo_id}/files/read')
async def read_file(repo_id: str, req: FileReadRequest):
    repo_dir = ensure_repo(repo_id)
    repo_real = os.path.realpath(str(repo_dir))
    file_real = os.path.realpath(os.path.join(repo_real, req.path))
    if not file_real.startswith(repo_real):
        raise HTTPException(status_code=403, detail='Path traversal not allowed')

    if not os.path.exists(file_real):
        raise HTTPException(status_code=404, detail=f'File not found: {req.path}')

    if not os.path.isfile(file_real):
        raise HTTPException(status_code=400, detail='Path is not a file')

    if os.path.getsize(file_real) > 1024 * 1024:
        raise HTTPException(status_code=413, detail='File too large (max 1MB)')

    try:
        with open(file_real) as f:
            content = f.read()
        return {'path': req.path, 'content': content, 'size': len(content)}
    except Exception as e:
        logger.error(f'File read failed: {str(e)}')
        raise HTTPException(status_code=500, detail=f'File read failed: {str(e)}')
