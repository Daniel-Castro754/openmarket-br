"""Add structured source metadata to public documents.

Revision ID: 0007_document_source_metadata
Revises: 0006_screener_metric_snapshots
Create Date: 2026-09-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_document_source_metadata"
down_revision: str | None = "0006_screener_metric_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "public_documents",
        sa.Column("source_category", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "public_documents",
        sa.Column("source_document_type", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "public_documents",
        sa.Column("source_species", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "public_documents",
        sa.Column("source_subject", sa.Text(), nullable=True),
    )
    op.add_column(
        "public_documents",
        sa.Column("source_presentation_type", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_public_documents_source_category",
        "public_documents",
        ["source_category"],
        unique=False,
    )
    op.create_index(
        "ix_public_documents_source_document_type",
        "public_documents",
        ["source_document_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_public_documents_source_document_type",
        table_name="public_documents",
    )
    op.drop_index(
        "ix_public_documents_source_category",
        table_name="public_documents",
    )
    op.drop_column("public_documents", "source_presentation_type")
    op.drop_column("public_documents", "source_subject")
    op.drop_column("public_documents", "source_species")
    op.drop_column("public_documents", "source_document_type")
    op.drop_column("public_documents", "source_category")
