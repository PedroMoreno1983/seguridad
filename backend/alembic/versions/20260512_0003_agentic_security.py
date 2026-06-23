"""agentic security control plane

Revision ID: 20260512_0003
Revises: 20260512_0002
Create Date: 2026-05-12
"""

from alembic import op

revision = "20260512_0003"
down_revision = "20260512_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS intervenciones (
            id BIGSERIAL PRIMARY KEY,
            comuna_id INTEGER NOT NULL REFERENCES comunas(id),
            tipo VARCHAR(100) NOT NULL,
            descripcion VARCHAR(500),
            fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
            fecha_fin TIMESTAMP WITH TIME ZONE,
            zona_bbox JSONB,
            centro_lat DOUBLE PRECISION,
            centro_lon DOUBLE PRECISION,
            impacto_estimado JSONB
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_intervenciones_comuna ON intervenciones(comuna_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_intervenciones_fecha ON intervenciones(fecha_inicio)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_runs (
            id BIGSERIAL PRIMARY KEY,
            comuna_id INTEGER NOT NULL REFERENCES comunas(id),
            user_id INTEGER REFERENCES usuarios(id),
            objective TEXT NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'planned',
            summary JSONB NOT NULL DEFAULT '{}'::jsonb,
            autonomy_level VARCHAR(30) NOT NULL DEFAULT 'supervised',
            agent_version VARCHAR(30) NOT NULL DEFAULT 'gaas-v1',
            reasoning_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
            last_observation JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    op.execute("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS autonomy_level VARCHAR(30) NOT NULL DEFAULT 'supervised'")
    op.execute("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS agent_version VARCHAR(30) NOT NULL DEFAULT 'gaas-v1'")
    op.execute("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS reasoning_trace JSONB NOT NULL DEFAULT '[]'::jsonb")
    op.execute("ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS last_observation JSONB NOT NULL DEFAULT '{}'::jsonb")
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_actions (
            id BIGSERIAL PRIMARY KEY,
            run_id BIGINT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
            action_key VARCHAR(80) NOT NULL,
            tool_name VARCHAR(80) NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            risk_level VARCHAR(20) NOT NULL DEFAULT 'medio',
            requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            preview JSONB NOT NULL DEFAULT '{}'::jsonb,
            result JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            executed_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_runs_comuna ON agent_runs(comuna_id, created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_actions_run ON agent_actions(run_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_agent_actions_run")
    op.execute("DROP INDEX IF EXISTS idx_agent_runs_comuna")
    op.execute("DROP TABLE IF EXISTS agent_actions")
    op.execute("DROP TABLE IF EXISTS agent_runs")
