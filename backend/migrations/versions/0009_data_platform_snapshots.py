"""Add persisted provider snapshots and synchronization runs.

Revision ID: 0009_data_platform_snapshots
Revises: 0008_price_history
Create Date: 2026-09-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_data_platform_snapshots"
down_revision: str | None = "0008_price_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "provider_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dataset", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "dataset",
            "provider",
            name="uq_provider_snapshots_dataset_provider",
        ),
    )
    op.create_index(
        "ix_provider_snapshots_dataset",
        "provider_snapshots",
        ["dataset"],
        unique=False,
    )
    op.create_index(
        "ix_provider_snapshots_provider",
        "provider_snapshots",
        ["provider"],
        unique=False,
    )

    op.create_table(
        "provider_sync_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("dataset", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("item_count", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_provider_sync_runs_provider_dataset_finished",
        "provider_sync_runs",
        ["provider", "dataset", "finished_at"],
        unique=False,
    )
    op.create_index(
        "ix_provider_sync_runs_status",
        "provider_sync_runs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_provider_sync_runs_status", table_name="provider_sync_runs")
    op.drop_index(
        "ix_provider_sync_runs_provider_dataset_finished",
        table_name="provider_sync_runs",
    )
    op.drop_table("provider_sync_runs")

    op.drop_index("ix_provider_snapshots_provider", table_name="provider_snapshots")
    op.drop_index("ix_provider_snapshots_dataset", table_name="provider_snapshots")
    op.drop_table("provider_snapshots")
