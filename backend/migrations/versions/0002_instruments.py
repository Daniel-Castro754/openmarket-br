"""Create listed instruments table.

Revision ID: 0002_instruments
Revises: 0001_market_core
Create Date: 2026-09-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_instruments"
down_revision: str | None = "0001_market_core"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "instruments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=True),
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("exchange", sa.String(length=16), nullable=False),
        sa.Column("isin", sa.String(length=32), nullable=True),
        sa.Column("issuer_name", sa.String(length=255), nullable=True),
        sa.Column("security_category", sa.String(length=128), nullable=True),
        sa.Column("specification", sa.String(length=128), nullable=True),
        sa.Column("governance_level", sa.String(length=128), nullable=True),
        sa.Column("instrument_type", sa.String(length=32), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("source", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exchange", "ticker", name="uq_instruments_exchange_ticker"),
    )
    op.create_index("ix_instruments_company_id", "instruments", ["company_id"], unique=False)
    op.create_index("ix_instruments_isin", "instruments", ["isin"], unique=False)
    op.create_index("ix_instruments_ticker", "instruments", ["ticker"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_instruments_ticker", table_name="instruments")
    op.drop_index("ix_instruments_isin", table_name="instruments")
    op.drop_index("ix_instruments_company_id", table_name="instruments")
    op.drop_table("instruments")
