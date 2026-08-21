import logging
import os
import sys
from contextlib import asynccontextmanager
import asyncio
import psycopg
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

logger = logging.getLogger(__name__)

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None
_setup_lock: asyncio.Lock | None = None

_DATABASE_URL = os.environ.get('DATABASE_URL')
if not _DATABASE_URL:
    logger.critical('DATABASE_URL environment variable is not set — cannot start langgraph-service')
    sys.exit(1)


async def _run_setup() -> None:
    async with await psycopg.AsyncConnection.connect(_DATABASE_URL, autocommit=True) as setup_conn:
        await AsyncPostgresSaver(setup_conn).setup()
    logger.info('Checkpointer setup complete')


async def get_checkpointer() -> AsyncPostgresSaver:
    if _checkpointer is None:
        raise RuntimeError('Checkpointer not initialized — lifespan startup failed')
    return _checkpointer


async def ensure_setup() -> None:
    """Re-run setup and re-initialize the pool. Called when checkpoint tables are found missing at runtime."""
    global _pool, _checkpointer, _setup_lock
    if _setup_lock is None:
        return
    async with _setup_lock:
        logger.warning('Checkpoint tables missing — re-running setup and re-initializing pool')
        await _run_setup()
        if _pool is not None:
            try:
                await _pool.close()
            except Exception:
                pass
        _pool = AsyncConnectionPool(conninfo=_DATABASE_URL, max_size=10, open=False)
        await _pool.open()
        _checkpointer = AsyncPostgresSaver(_pool)
        logger.info('Checkpointer re-initialized')


@asynccontextmanager
async def lifespan(_app):
    global _pool, _checkpointer, _setup_lock
    _setup_lock = asyncio.Lock()
    await _run_setup()
    _pool = AsyncConnectionPool(conninfo=_DATABASE_URL, max_size=10, open=False)
    await _pool.open()
    _checkpointer = AsyncPostgresSaver(_pool)
    yield
    if _pool is not None:
        await _pool.close()
