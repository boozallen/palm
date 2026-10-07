import re

import pytest

from lib.agent_env import agent_env

_USER_ID = '11111111-1111-4111-8111-111111111111'
_CHAT_MESSAGE_ID = '22222222-2222-4222-8222-222222222222'
_USER_GROUP_ID = '33333333-3333-4333-8333-333333333333'


def _parse_like_cli(raw: str) -> dict[str, str]:
    """Reimplementation of the bundled claude CLI's ANTHROPIC_CUSTOM_HEADERS
    parser, so the round-trip test locks our output format against the binary.
    """
    headers: dict[str, str] = {}
    for line in re.split(r'\n|\r\n', raw):
        if not line.strip():
            continue
        idx = line.find(':')
        if idx == -1:
            continue
        name = line[:idx].strip()
        value = line[idx + 1:].strip()
        if name:
            headers[name] = value
    return headers


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv('ANTHROPIC_BASE_URL', raising=False)
    monkeypatch.delenv('INTERNAL_API_KEY', raising=False)


def test_always_includes_base_url_and_api_key(monkeypatch):
    monkeypatch.setenv('ANTHROPIC_BASE_URL', 'http://example:3000/api/internal')
    monkeypatch.setenv('INTERNAL_API_KEY', 'secret-key')

    env = agent_env(_USER_ID)

    assert env['ANTHROPIC_BASE_URL'] == 'http://example:3000/api/internal'
    assert env['ANTHROPIC_API_KEY'] == 'secret-key'


def test_falls_back_to_the_in_cluster_base_url():
    assert agent_env()['ANTHROPIC_BASE_URL'] == 'http://frontend:3000/api/internal'


def test_both_ids_produce_one_header_line_each():
    env = agent_env(_USER_ID, _CHAT_MESSAGE_ID)

    assert env['ANTHROPIC_CUSTOM_HEADERS'] == (
        f'x-user-id: {_USER_ID}\n'
        f'x-chat-message-id: {_CHAT_MESSAGE_ID}'
    )


def test_user_id_alone_produces_a_single_header_line():
    assert agent_env(_USER_ID)['ANTHROPIC_CUSTOM_HEADERS'] == f'x-user-id: {_USER_ID}'


def test_chat_message_id_alone_produces_a_single_header_line():
    env = agent_env('', _CHAT_MESSAGE_ID)

    assert env['ANTHROPIC_CUSTOM_HEADERS'] == f'x-chat-message-id: {_CHAT_MESSAGE_ID}'


def test_omits_the_custom_headers_key_when_there_is_nothing_to_send():
    assert 'ANTHROPIC_CUSTOM_HEADERS' not in agent_env()


def test_treats_empty_and_whitespace_only_values_as_absent():
    assert 'ANTHROPIC_CUSTOM_HEADERS' not in agent_env('   ', '\t\n')


def test_strips_carriage_returns_and_newlines_from_values():
    env = agent_env(f'{_USER_ID}\r\nx-injected: evil', _CHAT_MESSAGE_ID)

    parsed = _parse_like_cli(env['ANTHROPIC_CUSTOM_HEADERS'])

    assert 'x-injected' not in parsed
    assert parsed['x-user-id'] == f'{_USER_ID}x-injected: evil'


def test_round_trips_through_the_cli_parser():
    env = agent_env(_USER_ID, _CHAT_MESSAGE_ID)

    assert _parse_like_cli(env['ANTHROPIC_CUSTOM_HEADERS']) == {
        'x-user-id': _USER_ID,
        'x-chat-message-id': _CHAT_MESSAGE_ID,
    }


def test_all_three_ids_produce_one_header_line_each():
    env = agent_env(_USER_ID, _CHAT_MESSAGE_ID, _USER_GROUP_ID)

    assert env['ANTHROPIC_CUSTOM_HEADERS'] == (
        f'x-user-id: {_USER_ID}\n'
        f'x-chat-message-id: {_CHAT_MESSAGE_ID}\n'
        f'x-user-group-id: {_USER_GROUP_ID}'
    )


def test_user_group_id_alone_produces_a_single_header_line():
    env = agent_env('', None, _USER_GROUP_ID)

    assert env['ANTHROPIC_CUSTOM_HEADERS'] == f'x-user-group-id: {_USER_GROUP_ID}'
