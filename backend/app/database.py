"""
Configuración de Base de Datos
==============================
Conexión PostgreSQL usando SQLAlchemy.
"""

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# URL de conexión (desde variables de entorno o default)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://safecity:safecity_secret@localhost:5432/safecity_db"
)

# Railway agrega el prefijo postgres:// en vez de postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Crear engine
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Cambiar a True para ver queries SQL
    pool_size=10,
    max_overflow=20
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para modelos
Base = declarative_base()


def get_db():
    """Dependency para obtener sesión de base de datos."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
