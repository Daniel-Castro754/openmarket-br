"""Allow long public document titles.

Revision ID: 0005_document_title_text
Revises: 0004_document_hub
Create Date: 2026-09-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_document_title_text"
down_revision: str | None = "0004_document_hub"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "public_documents",
        "title",
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE public_documents SET title = left(title, 500) WHERE length(title) > 500"
    )
    op.alter_column(
        "public_documents",
        "title",
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=False,
    )
