import logging

from claude_agent_sdk import query, ClaudeAgentOptions
from fastapi import FastAPI, Request
from pydantic import BaseModel

from endpoints.analyze import router as analyze_router
from endpoints.generate import router as generate_router
from endpoints.run_skill_command import router as skill_command_router
from lib.agent_env import agent_env
from lib.auth import verify_auth

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.include_router(analyze_router)
app.include_router(generate_router)
app.include_router(skill_command_router)


class PingRequest(BaseModel):
    model_id: str
    message: str
    user_id: str = ''


@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.post('/ping')
async def ping(request: Request, body: PingRequest):
    verify_auth(request)
    options = ClaudeAgentOptions(
        tools=['Bash'],
        allowed_tools=['Bash'],
        model=body.model_id,
        env=agent_env(body.user_id),
    )
    result_text = ''
    async for message in query(prompt=body.message, options=options):
        if hasattr(message, 'result') and message.result:
            result_text = message.result
    logger.info('[CLAUDE-SERVICE] ping model=%s response=%s', body.model_id, result_text[:100])
    return {'response': result_text}
