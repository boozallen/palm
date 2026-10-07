from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from queue import Empty, Queue
from typing import Generic, TypeVar


T = TypeVar('T')


class PoolExhausted(Exception):
    pass


class ConverterPool(Generic[T]):
    def __init__(self, items: Iterable[T]) -> None:
        self._items: Queue[T] = Queue()
        for item in items:
            self._items.put(item)

    def try_acquire(self) -> T | None:
        try:
            return self._items.get_nowait()
        except Empty:
            return None

    def release(self, item: T) -> None:
        self._items.put(item)

    @contextmanager
    def acquire(self) -> Iterator[T]:
        item = self.try_acquire()
        if item is None:
            raise PoolExhausted

        try:
            yield item
        finally:
            self.release(item)
