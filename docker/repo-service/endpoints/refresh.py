import logging
import os
import subprocess
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lib.paths import repo_path, REPOS_ROOT_REAL

logger = logging.getLogger(__name__)
router = APIRouter()


class RefreshRequest(BaseModel):
    repo_url: str
    access_token: Optional[str] = None
    branch: Optional[str] = 'main'


@router.post('/repos/{repo_id}/refresh')
async def refresh_repo(repo_id: str, req: RefreshRequest):
    repo_dir = repo_path(repo_id)
    repo_real = os.path.realpath(str(repo_dir))
    if not repo_real.startswith(REPOS_ROOT_REAL):
        raise HTTPException(status_code=400, detail='Invalid repo_id')
    branch = req.branch or 'main'

    logger.info(f'[repo-service] Refresh: id={repo_id}, branch={branch}')

    try:
        if not os.path.exists(os.path.join(repo_real, '.git')):
            if not req.repo_url:
                raise HTTPException(status_code=400, detail='repo_url required for initial clone')

            if req.access_token:
                escaped_token = quote(req.access_token, safe='')
                authed_url = req.repo_url.replace('https://', f'https://x-access-token:{escaped_token}@')
            else:
                authed_url = req.repo_url

            os.makedirs(repo_real, exist_ok=True)
            result = subprocess.run(
                ['git', 'clone', '--depth=1', f'--branch={branch}', authed_url, repo_real],
                capture_output=True,
                text=True,
                timeout=60,
            )

            if result.returncode != 0:
                logger.error(f'[repo-service] Clone failed: {result.stderr}')
                raise HTTPException(status_code=500, detail=f'git clone failed: {result.stderr}')

            logger.info(f'[repo-service] Cloned {repo_id}')

        if req.access_token:
            escaped_token = quote(req.access_token, safe='')
            authed_url = req.repo_url.replace('https://', f'https://x-access-token:{escaped_token}@')
            subprocess.run(
                ['git', '-C', repo_real, 'remote', 'set-url', 'origin', authed_url],
                capture_output=True, text=True, timeout=5,
            )

        result = subprocess.run(
            ['git', '-C', repo_real, 'fetch', '--depth', '1', 'origin', branch],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f'git fetch failed: {result.stderr}')

        result = subprocess.run(
            ['git', '-C', repo_real, 'reset', '--hard', f'origin/{branch}'],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f'git reset failed: {result.stderr}')

        result = subprocess.run(
            ['git', '-C', repo_real, 'rev-parse', 'HEAD'],
            capture_output=True, text=True, timeout=5,
        )
        commit_hash = result.stdout.strip() if result.returncode == 0 else 'unknown'

        return {
            'status': 'success',
            'repo_id': repo_id,
            'branch': branch,
            'commit': commit_hash,
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail='Refresh timeout')
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'[repo-service] Refresh failed: {e}', exc_info=e)
        raise HTTPException(status_code=500, detail=f'Refresh failed: {str(e)}')
