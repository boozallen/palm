import os
import ssl
import urllib3

os.environ['HF_HUB_DISABLE_XET'] = '1'

ssl._create_default_https_context = ssl._create_unverified_context
urllib3.disable_warnings()

# Patch requests (used by some libs)
import requests
_orig_requests_send = requests.Session.send

def _requests_patched(self, req, **kw):
    kw['verify'] = False
    return _orig_requests_send(self, req, **kw)

requests.Session.send = _requests_patched

# Patch httpx (used by huggingface_hub)
import httpx
_orig_client_init = httpx.Client.__init__
_orig_async_client_init = httpx.AsyncClient.__init__

def _httpx_client_init(self, *args, **kwargs):
    kwargs['verify'] = False
    _orig_client_init(self, *args, **kwargs)

def _httpx_async_client_init(self, *args, **kwargs):
    kwargs['verify'] = False
    _orig_async_client_init(self, *args, **kwargs)

httpx.Client.__init__ = _httpx_client_init
httpx.AsyncClient.__init__ = _httpx_async_client_init

# Corporate SSL-inspection proxies strip HuggingFace custom headers (X-Repo-Commit,
# ETag) from HEAD responses. Intercept httpx HEAD responses to HuggingFace and
# inject synthetic values before huggingface_hub reads them.
import hashlib as _hashlib

_orig_httpx_send = httpx.Client.send

def _patched_httpx_send(self, request, **kwargs):
    response = _orig_httpx_send(self, request, **kwargs)
    url_str = str(request.url)
    if request.method == 'HEAD' and ('huggingface.co' in url_str or 'hf.co' in url_str):
        headers_dict = dict(response.headers)
        if 'x-repo-commit' not in headers_dict:
            headers_dict['x-repo-commit'] = 'proxy-bypass'
        if 'etag' not in headers_dict and 'x-linked-etag' not in headers_dict:
            headers_dict['etag'] = f'"{_hashlib.md5(url_str.encode()).hexdigest()}"'
        response = httpx.Response(
            status_code=response.status_code,
            headers=headers_dict,
            content=b'',
            request=request,
        )
    return response

httpx.Client.send = _patched_httpx_send

import huggingface_hub.file_download as _hf_fd
_orig_raise_on_head_error = _hf_fd._raise_on_head_call_error

def _patched_raise_on_head_error(head_call_error, force_download, local_files_only):
    error_str = str(head_call_error)
    if 'X-Repo-Commit' in error_str or 'X-Linked-Etag' in error_str:
        return
    _orig_raise_on_head_error(head_call_error, force_download, local_files_only)

_hf_fd._raise_on_head_call_error = _patched_raise_on_head_error

from docling.utils.model_downloader import download_models
from pathlib import Path

download_models(output_dir=Path('/app/models'), progress=True)
print('Docling models downloaded successfully')

import tiktoken

tiktoken.get_encoding('cl100k_base')
print('Tiktoken cl100k_base vocabulary downloaded successfully')
