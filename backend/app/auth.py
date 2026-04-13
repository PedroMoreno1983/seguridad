"""
Autenticacion y Autorizacion
=============================
JWT tokens + password hashing + dependency injection para FastAPI.
"""

import os
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import Usuario

# ── Config ────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "safecity-dev-secret-key-change-in-production-2025")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72  # 3 dias

# ── Password hashing ─────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ── JWT Tokens ────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

# ── Dependencies ──────────────────────────────────────────────
async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[Usuario]:
    """Obtiene el usuario actual del token JWT. Retorna None si no hay token."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id: int = payload.get("sub")
        if user_id is None:
            return None
        user = db.query(Usuario).filter(Usuario.id == user_id, Usuario.activo == True).first()
        return user
    except JWTError:
        return None

async def require_auth(
    user: Optional[Usuario] = Depends(get_current_user),
) -> Usuario:
    """Requiere autenticacion. Lanza 401 si no hay usuario."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def require_role(*roles: str):
    """Factory: Requiere que el usuario tenga uno de los roles indicados."""
    async def dependency(user: Usuario = Depends(require_auth)) -> Usuario:
        if user.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol '{user.rol}' no tiene permisos. Se requiere: {', '.join(roles)}",
            )
        return user
    return dependency
