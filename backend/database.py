from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from config import DATABASE_URL


connect_args = (
    {"check_same_thread": False}
    if DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def migrate_schema():
    """
    Create missing tables and add any columns that were added to the
    models after the database was first created. This keeps existing
    local databases working without a separate migration tool.
    """

    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)

    with engine.begin() as connection:

        for table in Base.metadata.sorted_tables:

            existing = {
                column["name"]
                for column in inspector.get_columns(table.name)
            }

            for column in table.columns:

                if column.name in existing:
                    continue

                column_type = column.type.compile(dialect=engine.dialect)

                connection.execute(
                    text(
                        f'ALTER TABLE "{table.name}" '
                        f'ADD COLUMN "{column.name}" {column_type}'
                    )
                )
