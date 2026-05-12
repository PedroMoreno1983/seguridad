"""commercial schema hardening

Revision ID: 20260512_0001
Revises:
Create Date: 2026-05-12
"""

from alembic import op
import sqlalchemy as sa

revision = "20260512_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo_usuario VARCHAR(20) NOT NULL DEFAULT 'territorial'")
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS organizacion_id INTEGER")
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT '#3b82f6'")
    op.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS producto_preferido VARCHAR(20) NOT NULL DEFAULT 'territorio'")
    op.execute("CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo_usuario)")
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('organizaciones_privadas') IS NOT NULL
               AND NOT EXISTS (
                   SELECT 1 FROM pg_constraint WHERE conname = 'fk_usuarios_organizacion_privada'
               ) THEN
                ALTER TABLE usuarios
                    ADD CONSTRAINT fk_usuarios_organizacion_privada
                    FOREIGN KEY (organizacion_id) REFERENCES organizaciones_privadas(id);
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS educacion_comunal (
            id SERIAL PRIMARY KEY,
            comuna_id INTEGER NOT NULL REFERENCES comunas(id) ON DELETE CASCADE,
            anio INTEGER NOT NULL,
            matricula_total INTEGER,
            estudiantes_desvinculados INTEGER,
            tasa_desvinculacion NUMERIC(5,2),
            estudiantes_revinculados INTEGER,
            tasa_revinculacion NUMERIC(5,2),
            inasistencia_grave_pct NUMERIC(5,2),
            retiro_basica_pct NUMERIC(5,2),
            retiro_media_pct NUMERIC(5,2),
            fuente VARCHAR(120) DEFAULT 'Mineduc / Centro de Estudios',
            metodologia TEXT,
            fecha_actualizacion DATE,
            extra_data JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT uq_educacion_comuna_anio UNIQUE (comuna_id, anio)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_educacion_comunal_comuna ON educacion_comunal(comuna_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_educacion_comunal_anio ON educacion_comunal(anio)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS alertas_responsables (
            id SERIAL PRIMARY KEY,
            comuna_id INTEGER NOT NULL REFERENCES comunas(id) ON DELETE CASCADE,
            origen VARCHAR(80) NOT NULL DEFAULT 'SafeCity',
            categoria VARCHAR(80) NOT NULL,
            nivel_riesgo VARCHAR(20) NOT NULL DEFAULT 'medio',
            descripcion TEXT NOT NULL,
            confianza NUMERIC(4,2) DEFAULT 0.0,
            accion_sugerida TEXT,
            estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
            responsable VARCHAR(120),
            plazo_horas INTEGER DEFAULT 72,
            decision TEXT,
            criterios JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_alertas_responsables_comuna ON alertas_responsables(comuna_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_alertas_responsables_created ON alertas_responsables(created_at)")


def downgrade() -> None:
    op.drop_table("alertas_responsables")
    op.drop_table("educacion_comunal")
    op.execute("DROP INDEX IF EXISTS idx_usuarios_tipo")
    op.execute("ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS fk_usuarios_organizacion_privada")
    op.execute("ALTER TABLE usuarios DROP COLUMN IF EXISTS producto_preferido")
    op.execute("ALTER TABLE usuarios DROP COLUMN IF EXISTS avatar_color")
    op.execute("ALTER TABLE usuarios DROP COLUMN IF EXISTS organizacion_id")
    op.execute("ALTER TABLE usuarios DROP COLUMN IF EXISTS tipo_usuario")
