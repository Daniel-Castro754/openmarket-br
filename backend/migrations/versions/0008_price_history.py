"""Add persistent daily price history.

Revision ID: 0008_price_history
Revises: 0007_document_source_metadata
Create Date: 2026-09-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_price_history"
down_revision: str | None = "0007_document_source_metadata"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "quotes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("instrument_id", sa.Uuid(), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("price", sa.Numeric(28, 8), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="BRL"),
        sa.Column("source", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["instrument_id"], ["instruments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "instrument_id",
            "as_of",
            "provider",
            name="uq_quotes_instrument_date_provider",
        ),
    )
    op.create_index(
        "ix_quotes_instrument_date",
        "quotes",
        ["instrument_id", "as_of"],
        unique=False,
    )
    op.create_index(
        "ix_quotes_provider",
        "quotes",
        ["provider"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_quotes_provider", table_name="quotes")
    op.drop_index("ix_quotes_instrument_date", table_name="quotes")
    op.drop_table("quotes")
