import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)


def load_command_sources(repo_dir: Path, command: str, command_content: str) -> list:
    repo_real = os.path.realpath(str(repo_dir))
    commands_real = os.path.realpath(os.path.join(repo_real, '.claude', 'commands'))

    sources_real = os.path.realpath(os.path.join(commands_real, f'{command}.sources'))
    if not sources_real.startswith(commands_real):
        return []

    source_paths: list[str] = []

    if os.path.exists(sources_real):
        with open(sources_real) as f:
            source_paths = [
                line.strip() for line in f.read().splitlines()
                if line.strip() and not line.strip().startswith('#')
            ]
    elif command_content.startswith('---'):
        parts = command_content.split('---', 2)
        if len(parts) >= 2:
            for line in parts[1].split('\n'):
                if line.strip().startswith('- ') and '/' in line:
                    source_paths.append(line.strip().lstrip('- ').strip())

    if not source_paths:
        source_paths = _detect_paths_in_instructions(repo_real, command_content)

    sources = []
    for src_path in source_paths:
        full_real = os.path.realpath(os.path.join(repo_real, src_path))
        if not full_real.startswith(repo_real):
            continue
        if os.path.isdir(full_real):
            for md_file in sorted(Path(full_real).glob('*.md')):
                md_real = os.path.realpath(str(md_file))
                if not md_real.startswith(repo_real):
                    continue
                rel = os.path.relpath(md_real, repo_real)
                with open(md_real) as f:
                    content = f.read()
                if len(content) > 50_000:
                    content = content[:50_000] + '\n\n[…truncated]'
                sources.append({'path': rel, 'content': content})
        elif os.path.exists(full_real):
            with open(full_real) as f:
                content = f.read()
            if len(content) > 50_000:
                content = content[:50_000] + '\n\n[…truncated]'
            sources.append({'path': src_path, 'content': content})
        else:
            sources.append({'path': src_path, 'error': 'File not found'})

    return sources


def _detect_paths_in_instructions(repo_real: str, command_content: str) -> list[str]:
    candidates = re.findall(r'`([t][123]-[^`]+)`', command_content)
    candidates += re.findall(r'(?<!\w)([t][123]-[\w\-]+/[\w\-/.]+)', command_content)

    seen: set[str] = set()
    result: list[str] = []
    for candidate in candidates:
        candidate = candidate.rstrip('.,;:)')
        if candidate in seen:
            continue
        seen.add(candidate)
        full_real = os.path.realpath(os.path.join(repo_real, candidate))
        if not full_real.startswith(repo_real):
            continue
        if os.path.exists(full_real):
            result.append(candidate)

    logger.info('[repo-service] Auto-detected %d source paths for command', len(result))
    return result
