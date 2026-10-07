import logging
import os

import httpx

logger = logging.getLogger(__name__)

_INTERNAL_API_KEY = os.environ.get('INTERNAL_API_KEY', '')
_ANTHROPIC_BASE_URL = os.environ.get('ANTHROPIC_BASE_URL', 'http://frontend:3000/api/internal')


async def inference(
    user_id: str,
    model_id: str,
    prompt: str,
    max_tokens: int = 16000,
    chat_message_id: str | None = None,
) -> str:
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            f'{_ANTHROPIC_BASE_URL}/inference',
            headers={'Authorization': f'Bearer {_INTERNAL_API_KEY}'},
            json={
                'userId': user_id,
                'modelId': model_id,
                'messages': [{'role': 'user', 'content': prompt}],
                'maxTokens': max_tokens,
                'chatMessageId': chat_message_id,
            },
        )
        resp.raise_for_status()
        result = resp.json().get('text', '')
    logger.info('[CLAUDE-SERVICE] inference complete len=%d', len(result))
    return result


