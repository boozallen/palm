from pathlib import Path

from fastapi import HTTPException

SKILLS_DIR = Path(__file__).parents[1] / 'skills'

_shared_themes = SKILLS_DIR / '_shared' / 'themes.md'
_SHARED_THEMES_PREFIX = (_shared_themes.read_text() + '\n---\n\n') if _shared_themes.exists() else ''
# themes.md is HTML/CSS design-style guidance for presentations and videos only
_THEMED_SKILLS = {'presentation', 'video'}


def load_skill(skill_name: str) -> str:
    skill_dir = SKILLS_DIR / skill_name
    skill_file = skill_dir / 'SKILL.md'
    if not skill_file.exists():
        raise HTTPException(status_code=422, detail=f'Unknown skill: {skill_name}')
    prefix = _SHARED_THEMES_PREFIX if skill_name in _THEMED_SKILLS else ''
    return prefix + skill_file.read_text()
