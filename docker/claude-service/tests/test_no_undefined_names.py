"""Guards the service source against undefined names.

A NameError in a branch that rarely runs — an f-string assembling a code
snippet for a subprocess, an error path — stays invisible until that branch
executes in production. Import-time checks miss it because the module still
imports cleanly, and unit tests miss it unless they happen to cover that exact
line. pyflakes reads every line without running any of it, so it catches the
whole class at once.

Only undefined names are asserted on. Unused imports and unused locals are
style findings that pyflakes also reports; an undefined name is always a bug.
"""
import ast
from pathlib import Path

from pyflakes import checker, messages

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
_SOURCE_DIRS = ('endpoints', 'lib')
_BUG_TYPES = (messages.UndefinedName, messages.UndefinedLocal, messages.UndefinedExport)


def _source_files() -> list[Path]:
    files = [_SERVICE_ROOT / 'main.py']
    for directory in _SOURCE_DIRS:
        files.extend(sorted((_SERVICE_ROOT / directory).glob('*.py')))
    return [path for path in files if path.exists()]


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
    found = [finding for path in _source_files() for finding in _undefined_names(path)]

    assert found == [], 'undefined names found:\n' + '\n'.join(found)
