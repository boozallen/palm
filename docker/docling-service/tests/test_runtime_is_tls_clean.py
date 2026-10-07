import ast
from pathlib import Path


_SERVICE_ROOT = Path(__file__).resolve().parent.parent
_FORBIDDEN_IMPORTS = {'ssl', 'requests', 'urllib3', 'httpx', 'huggingface_hub'}


def _imported_modules(tree: ast.AST) -> set[str]:
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name.split('.')[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.add(node.module.split('.')[0])
    return modules


def _environment_key(target: ast.AST) -> str | None:
    if not isinstance(target, ast.Subscript):
        return None
    if not isinstance(target.value, ast.Attribute):
        return None
    if not isinstance(target.value.value, ast.Name):
        return None
    if target.value.value.id != 'os' or target.value.attr != 'environ':
        return None
    if isinstance(target.slice, ast.Constant) and isinstance(target.slice.value, str):
        return target.slice.value
    return None


def test_runtime_module_has_no_tls_workarounds():
    tree = ast.parse((_SERVICE_ROOT / 'main.py').read_text())

    assert _imported_modules(tree).isdisjoint(_FORBIDDEN_IMPORTS)

    assigned_keys = {
        key
        for node in ast.walk(tree)
        if isinstance(node, ast.Assign)
        for target in node.targets
        if (key := _environment_key(target)) is not None
    }
    assert all(
        'HTTPSVERIFY' not in key and not key.startswith('HF_HUB_')
        for key in assigned_keys
    )


def test_model_downloader_keeps_build_time_workaround():
    tree = ast.parse((_SERVICE_ROOT / 'download_models.py').read_text())

    imported_from_modules = {
        node.module
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom) and node.module
    }
    assert 'docling.utils.model_downloader' in imported_from_modules
    assert 'tiktoken' in _imported_modules(tree)

    encoding_calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == 'tiktoken'
        and node.func.attr == 'get_encoding'
    ]
    assert any(
        len(call.args) == 1
        and isinstance(call.args[0], ast.Constant)
        and call.args[0].value == 'cl100k_base'
        for call in encoding_calls
    )


def test_tiktoken_cache_is_configured_before_model_download():
    dockerfile_lines = (_SERVICE_ROOT / 'Dockerfile').read_text().splitlines()

    cache_env_line = next(
        index
        for index, line in enumerate(dockerfile_lines)
        if line.startswith('ENV TIKTOKEN_CACHE_DIR=')
    )
    download_line = next(
        index
        for index, line in enumerate(dockerfile_lines)
        if 'download_models.py' in line
    )

    assert cache_env_line < download_line
