"""geospatial quality repair

Revision ID: 20260512_0002
Revises: 20260512_0001
Create Date: 2026-05-12
"""

from alembic import op

revision = "20260512_0002"
down_revision = "20260512_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE comunas ADD COLUMN IF NOT EXISTS centroid_lat DOUBLE PRECISION")
    op.execute("ALTER TABLE comunas ADD COLUMN IF NOT EXISTS centroid_lon DOUBLE PRECISION")
    op.execute("ALTER TABLE comunas ADD COLUMN IF NOT EXISTS bbox JSONB")
    op.execute("ALTER TABLE comunas ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'comunas' AND column_name = 'metadata'
            ) THEN
                UPDATE comunas
                SET extra_data = COALESCE(extra_data, '{}'::jsonb) || COALESCE(metadata, '{}'::jsonb)
                WHERE metadata IS NOT NULL;
            END IF;
        END $$;
        """
    )

    op.execute("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION")
    op.execute("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION")
    op.execute("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS geocode_precision VARCHAR(20) DEFAULT 'sin_senal'")
    op.execute("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS geocode_source VARCHAR(80)")
    op.execute("ALTER TABLE delitos ADD COLUMN IF NOT EXISTS geocode_confidence NUMERIC(4,2)")
    op.execute("ALTER TABLE delitos ALTER COLUMN geocode_precision SET DEFAULT 'sin_senal'")
    op.execute("UPDATE delitos SET geocode_precision = 'sin_senal' WHERE geocode_precision IS NULL")
    op.execute("CREATE INDEX IF NOT EXISTS idx_delitos_geocode_precision ON delitos(geocode_precision)")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'delitos' AND column_name = 'ubicacion'
            ) THEN
                ALTER TABLE delitos ALTER COLUMN ubicacion DROP NOT NULL;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'chk_delitos_geocode_precision'
            ) THEN
                ALTER TABLE delitos
                    ADD CONSTRAINT chk_delitos_geocode_precision
                    CHECK (geocode_precision IN ('exacta', 'sector', 'comuna', 'sin_senal'));
            END IF;
        END $$;
        """
    )

    op.execute("ALTER TABLE predicciones ADD COLUMN IF NOT EXISTS zona_bbox JSONB")
    op.execute("ALTER TABLE predicciones ADD COLUMN IF NOT EXISTS centro_lat DOUBLE PRECISION")
    op.execute("ALTER TABLE predicciones ADD COLUMN IF NOT EXISTS centro_lon DOUBLE PRECISION")

    op.execute("ALTER TABLE features_espaciales ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION")
    op.execute("ALTER TABLE features_espaciales ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION")
    op.execute("ALTER TABLE features_espaciales ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'features_espaciales' AND column_name = 'ubicacion'
            ) THEN
                ALTER TABLE features_espaciales ALTER COLUMN ubicacion DROP NOT NULL;
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'features_espaciales' AND column_name = 'metadata'
            ) THEN
                UPDATE features_espaciales
                SET extra_data = COALESCE(extra_data, '{}'::jsonb) || COALESCE(metadata, '{}'::jsonb)
                WHERE metadata IS NOT NULL;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE delitos DROP CONSTRAINT IF EXISTS chk_delitos_geocode_precision")
    op.execute("DROP INDEX IF EXISTS idx_delitos_geocode_precision")
    op.execute("ALTER TABLE delitos DROP COLUMN IF EXISTS geocode_confidence")
    op.execute("ALTER TABLE delitos DROP COLUMN IF EXISTS geocode_source")
    op.execute("ALTER TABLE delitos DROP COLUMN IF EXISTS geocode_precision")
