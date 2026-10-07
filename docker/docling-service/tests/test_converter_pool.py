import pytest

from converter_pool import ConverterPool, PoolExhausted


def test_try_acquire_returns_each_item_once_then_none():
    pool = ConverterPool(['first', 'second'])

    assert pool.try_acquire() == 'first'
    assert pool.try_acquire() == 'second'
    assert pool.try_acquire() is None


def test_release_makes_item_available_again():
    pool = ConverterPool(['converter'])
    converter = pool.try_acquire()

    assert converter == 'converter'
    assert pool.try_acquire() is None

    pool.release(converter)

    assert pool.try_acquire() == 'converter'


def test_acquire_raises_when_pool_is_empty():
    pool = ConverterPool([])

    with pytest.raises(PoolExhausted):
        with pool.acquire():
            pass


def test_acquire_releases_on_normal_exit():
    pool = ConverterPool(['converter'])

    with pool.acquire() as converter:
        assert converter == 'converter'
        assert pool.try_acquire() is None

    assert pool.try_acquire() == 'converter'


def test_acquire_releases_on_exception():
    pool = ConverterPool(['converter'])

    with pytest.raises(RuntimeError, match='conversion failed'):
        with pool.acquire() as converter:
            assert converter == 'converter'
            raise RuntimeError('conversion failed')

    assert pool.try_acquire() == 'converter'
