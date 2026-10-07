import json
import logging
import os
import subprocess

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lib.paths import ensure_repo

logger = logging.getLogger(__name__)
router = APIRouter()


class SearchRequest(BaseModel):
    repo_id: str
    query: str
    path: str = ''


@router.post('/repos/{repo_id}/search')
async def search(repo_id: str, req: SearchRequest):
    repo_dir = ensure_repo(repo_id)
    repo_real = os.path.realpath(str(repo_dir))

    if req.path:
        search_real = os.path.realpath(os.path.join(repo_real, req.path))
        if not search_real.startswith(repo_real):
            raise HTTPException(status_code=403, detail='Path traversal not allowed')
        search_path = search_real
    else:
        search_path = repo_real

    if not os.path.exists(search_path):
        raise HTTPException(status_code=404, detail=f'Path not found: {req.path}')

    try:
        result = subprocess.run(
            ['rg', '--json', '--type', 'md', '--max-count', '50',
             '--smart-case', req.query, search_path],
            capture_output=True, text=True, timeout=30,
        )

        hits = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            try:
                data = json.loads(line)
                if data.get('type') == 'match':
                    file_path = data['data']['path']['text']
                    relative_path = file_path.replace(repo_real + '/', '')
                    hits.append({
                        'file': relative_path,
                        'line': data['data']['line_number'],
                        'snippet': data['data']['lines']['text'].strip(),
                    })
            except json.JSONDecodeError:
                continue

        return {'hits': hits, 'truncated': len(hits) >= 50}

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail='Search timeout')
    except Exception as e:
        logger.error(f'Search failed: {str(e)}')
        raise HTTPException(status_code=500, detail=f'Search failed: {str(e)}')
