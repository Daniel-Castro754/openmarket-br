"""Add document processing audit fields.

Revision ID: 0010_document_processing_audit
Revises: 0009_data_platform_snapshots
Create Date: 2026-09-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_document_processing_audit"
down_revision: str | None = "0009_data_platform_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "public_documents",
        sa.Column("content_size_bytes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "public_documents",
        sa.Column("content_sha256", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "public_documents",
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "public_documents",
        sa.Column("processing_error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("public_documents", "processing_error")
    op.drop_column("public_documents", "processed_at")
    op.drop_column("public_documents", "content_sha256")
    op.drop_column("public_documents", "content_size_bytes")
