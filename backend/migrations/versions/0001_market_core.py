"""Create company and financial statement tables.

Revision ID: 0001_market_core
Revises:
Create Date: 2026-09-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_market_core"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("legal_name", sa.String(length=255), nullable=False),
        sa.Column("trading_name", sa.String(length=255), nullable=True),
        sa.Column("cnpj", sa.String(length=32), nullable=True),
        sa.Column("cvm_code", sa.String(length=32), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("investor_relations_url", sa.String(length=500), nullable=True),
        sa.Column("source", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cnpj"),
        sa.UniqueConstraint("cvm_code"),
    )
    op.create_index("ix_companies_cnpj", "companies", ["cnpj"], unique=False)
    op.create_index("ix_companies_cvm_code", "companies", ["cvm_code"], unique=False)

    op.create_table(
        "financial_statement_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("natural_key", sa.String(length=255), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("statement", sa.String(length=32), nullable=False),
        sa.Column("account_code", sa.String(length=64), nullable=False),
        sa.Column("account_name", sa.String(length=500), nullable=False),
        sa.Column("value", sa.Numeric(precision=28, scale=6), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("consolidated", sa.Boolean(), nullable=False),
        sa.Column("source", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("natural_key"),
    )
    op.create_index(
        "ix_financial_statement_items_account_code",
        "financial_statement_items",
        ["account_code"],
        unique=False,
    )
    op.create_index(
        "ix_financial_statement_items_company_id",
        "financial_statement_items",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        "ix_financial_statement_items_natural_key",
        "financial_statement_items",
        ["natural_key"],
        unique=False,
    )
    op.create_index(
        "ix_financial_statement_items_period_end",
        "financial_statement_items",
        ["period_end"],
        unique=False,
    )
    op.create_index(
        "ix_financial_statement_items_statement",
        "financial_statement_items",
        ["statement"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_financial_statement_items_statement", table_name="financial_statement_items")
    op.drop_index("ix_financial_statement_items_period_end", table_name="financial_statement_items")
    op.drop_index("ix_financial_statement_items_natural_key", table_name="financial_statement_items")
    op.drop_index("ix_financial_statement_items_company_id", table_name="financial_statement_items")
    op.drop_index("ix_financial_statement_items_account_code", table_name="financial_statement_items")
    op.drop_table("financial_statement_items")
    op.drop_index("ix_companies_cvm_code", table_name="companies")
    op.drop_index("ix_companies_cnpj", table_name="companies")
    op.drop_table("companies")
