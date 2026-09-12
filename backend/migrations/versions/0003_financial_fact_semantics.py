"""Add CVM filing semantics to financial facts.

Revision ID: 0003_financial_fact_semantics
Revises: 0002_instruments
Create Date: 2026-09-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_financial_fact_semantics"
down_revision: str | None = "0002_instruments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "financial_statement_items",
        "natural_key",
        existing_type=sa.String(length=255),
        type_=sa.String(length=512),
        existing_nullable=False,
    )
    op.add_column(
        "financial_statement_items",
        sa.Column("filing_type", sa.String(length=16), nullable=True),
    )
    op.add_column(
        "financial_statement_items",
        sa.Column("filing_reference_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "financial_statement_items",
        sa.Column("filing_version", sa.Integer(), nullable=True),
    )
    op.add_column(
        "financial_statement_items",
        sa.Column("exercise_order", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "financial_statement_items",
        sa.Column("fixed_account", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "financial_statement_items",
        sa.Column("statement_group", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_financial_statement_items_filing_type",
        "financial_statement_items",
        ["filing_type"],
        unique=False,
    )
    op.create_index(
        "ix_financial_statement_items_filing_reference_date",
        "financial_statement_items",
        ["filing_reference_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_financial_statement_items_filing_reference_date",
        table_name="financial_statement_items",
    )
    op.drop_index(
        "ix_financial_statement_items_filing_type",
        table_name="financial_statement_items",
    )
    op.drop_column("financial_statement_items", "statement_group")
    op.drop_column("financial_statement_items", "fixed_account")
    op.drop_column("financial_statement_items", "exercise_order")
    op.drop_column("financial_statement_items", "filing_version")
    op.drop_column("financial_statement_items", "filing_reference_date")
    op.drop_column("financial_statement_items", "filing_type")
    op.alter_column(
        "financial_statement_items",
        "natural_key",
        existing_type=sa.String(length=512),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
