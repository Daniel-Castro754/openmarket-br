"""Add public document hub tables.

Revision ID: 0004_document_hub
Revises: 0003_financial_fact_semantics
Create Date: 2026-09-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_document_hub"
down_revision: str | None = "0003_financial_fact_semantics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "public_documents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("natural_key", sa.String(length=1024), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("document_type", sa.String(length=64), nullable=False),
        sa.Column("source_url", sa.String(length=1500), nullable=True),
        sa.Column("published_at", sa.Date(), nullable=True),
        sa.Column("reference_period", sa.String(length=64), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("processing_status", sa.String(length=32), nullable=False),
        sa.Column("source", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("natural_key"),
    )
    op.create_index(
        "ix_public_documents_natural_key",
        "public_documents",
        ["natural_key"],
        unique=True,
    )
    op.create_index(
        "ix_public_documents_company_id",
        "public_documents",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        "ix_public_documents_document_type",
        "public_documents",
        ["document_type"],
        unique=False,
    )
    op.create_index(
        "ix_public_documents_published_at",
        "public_documents",
        ["published_at"],
        unique=False,
    )
    op.create_index(
        "ix_public_documents_processing_status",
        "public_documents",
        ["processing_status"],
        unique=False,
    )

    op.create_table(
        "document_sections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=True),
        sa.Column("page_end", sa.Integer(), nullable=True),
        sa.Column("heading", sa.String(length=500), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["public_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "document_id",
            "sequence",
            name="uq_document_sections_document_sequence",
        ),
    )
    op.create_index(
        "ix_document_sections_document_id",
        "document_sections",
        ["document_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_document_sections_document_id", table_name="document_sections")
    op.drop_table("document_sections")
    op.drop_index("ix_public_documents_processing_status", table_name="public_documents")
    op.drop_index("ix_public_documents_published_at", table_name="public_documents")
    op.drop_index("ix_public_documents_document_type", table_name="public_documents")
    op.drop_index("ix_public_documents_company_id", table_name="public_documents")
    op.drop_index("ix_public_documents_natural_key", table_name="public_documents")
    op.drop_table("public_documents")
