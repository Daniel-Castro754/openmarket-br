from collections.abc import Iterator

from sqlalchemy.orm import Session

from openmarket_api.persistence.database import get_session_factory


def get_db_session() -> Iterator[Session]:
    factory = get_session_factory()
    with factory() as session:
        yield session
