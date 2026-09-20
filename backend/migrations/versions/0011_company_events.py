"""Add unified company event read model.

Revision ID: 0011_company_events
Revises: 0010_document_processing_audit
Create Date: 2026-09-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_company_events"
down_revision: str | None = "0010_document_processing_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "company_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("natural_key", sa.String(length=160), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("origin", sa.String(length=32), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reference_period", sa.String(length=64), nullable=True),
        sa.Column("source_document_id", sa.Uuid(), nullable=True),
        sa.Column("source_url", sa.String(length=1500), nullable=True),
        sa.Column("source_classification", sa.String(length=500), nullable=True),
        sa.Column("source", sa.JSON(), nullable=False),
        sa.Column("projected_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_document_id"],
            ["public_documents.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("natural_key", name="uq_company_events_natural_key"),
        sa.UniqueConstraint(
            "source_document_id",
            name="uq_company_events_source_document_id",
        ),
    )
    op.create_index(
        "ix_company_events_company_date",
        "company_events",
        ["company_id", "event_date"],
        unique=False,
    )
    op.create_index(
        "ix_company_events_category",
        "company_events",
        ["category"],
        unique=False,
    )
    op.create_index(
        "ix_company_events_event_type",
        "company_events",
        ["event_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_company_events_event_type", table_name="company_events")
    op.drop_index("ix_company_events_category", table_name="company_events")
    op.drop_index("ix_company_events_company_date", table_name="company_events")
    op.drop_table("company_events")
