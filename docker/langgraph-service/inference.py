import json
import os
from typing import Any, AsyncGenerator

import httpx

_NEXT_URL = os.environ.get('NEXTJS_INTERNAL_URL', 'http://frontend:3000')
_API_KEY = os.environ.get('INTERNAL_API_KEY', '')


async def chat_completion_with_tools(
    user_id: str,
    model_id: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    temperature: float = 0.2,
    top_p: float = 0.5,
    force_tool_use: bool = False,
    chat_message_id: str | None = None,
    step_label: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        'userId': user_id,
        'modelId': model_id,
        'messages': messages,
        'tools': tools,
        'temperature': temperature,
        'topP': top_p,
        'forceToolUse': force_tool_use,
    }
    if chat_message_id:
        payload['chatMessageId'] = chat_message_id
    if step_label:
        payload['stepLabel'] = step_label
    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(
            f'{_NEXT_URL}/api/internal/inference-with-tools',
            headers={'Authorization': f'Bearer {_API_KEY}'},
            json=payload,
        )
        response.raise_for_status()
        return response.json()


async def stream_chat_completion_with_tools(
    user_id: str,
    model_id: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    temperature: float = 0.2,
    top_p: float = 0.5,
    force_tool_use: bool = False,
    chat_message_id: str | None = None,
    step_label: str | None = None,
) -> AsyncGenerator[dict[str, Any], None]:
    payload: dict[str, Any] = {
        'userId': user_id,
        'modelId': model_id,
        'messages': messages,
        'tools': tools,
        'temperature': temperature,
        'topP': top_p,
        'forceToolUse': force_tool_use,
    }
    if chat_message_id:
        payload['chatMessageId'] = chat_message_id
    if step_label:
        payload['stepLabel'] = step_label
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            'POST',
            f'{_NEXT_URL}/api/internal/inference-with-tools-stream',
            headers={'Authorization': f'Bearer {_API_KEY}'},
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith('data: '):
                    data = line[6:]
                    try:
                        yield json.loads(data)
                    except json.JSONDecodeError:
                        pass
