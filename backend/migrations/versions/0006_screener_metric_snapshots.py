"""Add persistent screener metric snapshots.

Revision ID: 0006_screener_metric_snapshots
Revises: 0005_document_title_text
Create Date: 2026-09-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_screener_metric_snapshots"
down_revision: str | None = "0005_document_title_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "screener_metric_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("instrument_id", sa.Uuid(), nullable=False),
        sa.Column("metric", sa.String(length=64), nullable=False),
        sa.Column("frequency", sa.String(length=16), nullable=False, server_default="annual"),
        sa.Column("value", sa.Numeric(28, 6), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("source_latest_period", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["instrument_id"], ["instruments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "instrument_id",
            "metric",
            "frequency",
            name="uq_screener_metric_snapshot_key",
        ),
    )
    op.create_index(
        "ix_screener_metric_snapshots_instrument_id",
        "screener_metric_snapshots",
        ["instrument_id"],
        unique=False,
    )
    op.create_index(
        "ix_screener_metric_snapshots_metric_value",
        "screener_metric_snapshots",
        ["metric", "value"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_screener_metric_snapshots_metric_value",
        table_name="screener_metric_snapshots",
    )
    op.drop_index(
        "ix_screener_metric_snapshots_instrument_id",
        table_name="screener_metric_snapshots",
    )
    op.drop_table("screener_metric_snapshots")
