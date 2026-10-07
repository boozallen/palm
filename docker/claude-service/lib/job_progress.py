import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_INTERNAL_API_KEY = os.environ.get('INTERNAL_API_KEY', '')
_ANTHROPIC_BASE_URL = os.environ.get('ANTHROPIC_BASE_URL', 'http://frontend:3000/api/internal')


async def post_progress(job_id: str, progress: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f'{_ANTHROPIC_BASE_URL}/update-job-progress',
                headers={'Authorization': f'Bearer {_INTERNAL_API_KEY}'},
                json={'jobId': job_id, 'progress': progress},
            )
    except Exception:
        pass


async def post_event(job_id: str | None, event: dict[str, Any]) -> None:
    if not job_id:
        return
    await post_progress(job_id, json.dumps(event))
