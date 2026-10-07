import os

_DEFAULT_BASE_URL = 'http://frontend:3000/api/internal'

_USER_ID_HEADER = 'x-user-id'
_CHAT_MESSAGE_ID_HEADER = 'x-chat-message-id'
_USER_GROUP_ID_HEADER = 'x-user-group-id'


def _clean(value: str | None) -> str:
    """Drop CR and LF before trimming.

    The bundled claude CLI parses ANTHROPIC_CUSTOM_HEADERS by splitting on
    newlines and has no escape syntax, so a newline inside a value would inject
    arbitrary headers into every request the agent makes.
    """
    if not value:
        return ''
    return value.replace('\r', '').replace('\n', '').strip()


def _custom_headers(user_id: str, chat_message_id: str | None, user_group_id: str | None) -> str:
    lines = [
        f'{name}: {cleaned}'
        for name, cleaned in (
            (_USER_ID_HEADER, _clean(user_id)),
            (_CHAT_MESSAGE_ID_HEADER, _clean(chat_message_id)),
            (_USER_GROUP_ID_HEADER, _clean(user_group_id)),
        )
        if cleaned
    ]
    return '\n'.join(lines)


def agent_env(
    user_id: str = '',
    chat_message_id: str | None = None,
    user_group_id: str | None = None,
) -> dict[str, str]:
    """Environment for a ClaudeAgentOptions, pointing the bundled CLI at the
    frontend proxy and naming the user, chat message, and user group the spend
    belongs to.

    The frontend reads those headers to decide whether it can write an
    AiProviderUsage row and which group to attribute it to, so a call that
    omits them is billed but untracked/unattributed.
    """
    env = {
        'ANTHROPIC_BASE_URL': os.environ.get('ANTHROPIC_BASE_URL', _DEFAULT_BASE_URL),
        'ANTHROPIC_API_KEY': os.environ.get('INTERNAL_API_KEY', ''),
    }

    # Absent rather than empty: the CLI skips header parsing entirely when the
    # variable is falsy, and an empty string would be a no-op it still parses.
    headers = _custom_headers(user_id, chat_message_id, user_group_id)
    if headers:
        env['ANTHROPIC_CUSTOM_HEADERS'] = headers

    return env
