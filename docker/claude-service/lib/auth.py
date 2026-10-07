import os

from fastapi import HTTPException, Request

_INTERNAL_API_KEY = os.environ.get('INTERNAL_API_KEY', '')


def verify_auth(request: Request) -> None:
    if not _INTERNAL_API_KEY:
        raise HTTPException(status_code=500, detail='INTERNAL_API_KEY is not configured')
    auth = request.headers.get('Authorization', '')
    if auth != f'Bearer {_INTERNAL_API_KEY}':
        raise HTTPException(status_code=401, detail='Unauthorized')
