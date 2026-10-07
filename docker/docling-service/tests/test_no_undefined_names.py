"""Guards the service source against undefined names."""
import ast
from pathlib import Path

from pyflakes import checker, messages


_SERVICE_ROOT = Path(__file__).resolve().parent.parent
_SOURCE_FILES = (
    'main.py',
    'chunk_assembly.py',
    'converter_pool.py',
    'download_models.py',
)
_BUG_TYPES = (
    messages.UndefinedName,
    messages.UndefinedLocal,
    messages.UndefinedExport,
)


def _undefined_names(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    result = checker.Checker(tree, filename=str(path))
    return [
        f'{path.relative_to(_SERVICE_ROOT)}:{message.lineno}: '
        f'{message.message % message.message_args}'
        for message in result.messages
        if isinstance(message, _BUG_TYPES)
    ]


def test_source_has_no_undefined_names():
    found = [
        finding
        for source_file in _SOURCE_FILES
        for finding in _undefined_names(_SERVICE_ROOT / source_file)
    ]

    assert found == [], 'undefined names found:\n' + '\n'.join(found)
