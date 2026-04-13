"""
Router de Autenticación
========================
Registro, login, perfil de usuario.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import Usuario
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_auth,
)

router = APIRouter(prefix="/auth")


# ── Schemas ───────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    rol: str = "ciudadano"  # ciudadano | autoridad | tecnico
    comuna_id: Optional[int] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UpdateProfileRequest(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    comuna_id: Optional[int] = None
    avatar_color: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Registrar nuevo usuario."""
    # Validar rol
    if body.rol not in ("ciudadano", "autoridad", "tecnico"):
        raise HTTPException(400, "Rol inválido. Opciones: ciudadano, autoridad, tecnico")

    # Verificar email único
    existing = db.query(Usuario).filter(Usuario.email == body.email).first()
    if existing:
        raise HTTPException(409, "Ya existe una cuenta con este correo electrónico")

    # Crear usuario
    user = Usuario(
        nombre=body.nombre,
        email=body.email,
        password_hash=hash_password(body.password),
        rol=body.rol,
        comuna_id=body.comuna_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generar token
    token = create_access_token({"sub": user.id, "rol": user.rol})

    return TokenResponse(access_token=token, user=user.to_dict())


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Iniciar sesión."""
    user = db.query(Usuario).filter(Usuario.email == body.email).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    if not user.activo:
        raise HTTPException(403, "Cuenta desactivada. Contacte al administrador.")

    token = create_access_token({"sub": user.id, "rol": user.rol})

    return TokenResponse(access_token=token, user=user.to_dict())


@router.get("/me")
def get_profile(user: Usuario = Depends(require_auth)):
    """Obtener perfil del usuario autenticado."""
    return user.to_dict()


@router.put("/me")
def update_profile(
    body: UpdateProfileRequest,
    user: Usuario = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Actualizar perfil."""
    if body.nombre is not None:
        user.nombre = body.nombre
    if body.email is not None:
        # Verificar que no exista otro usuario con ese email
        exists = db.query(Usuario).filter(
            Usuario.email == body.email, Usuario.id != user.id
        ).first()
        if exists:
            raise HTTPException(409, "Ese correo ya está en uso")
        user.email = body.email
    if body.comuna_id is not None:
        user.comuna_id = body.comuna_id
    if body.avatar_color is not None:
        user.avatar_color = body.avatar_color

    db.commit()
    db.refresh(user)
    return user.to_dict()


@router.put("/me/password")
def change_password(
    body: ChangePasswordRequest,
    user: Usuario = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Cambiar contraseña."""
    if not verify_password(body.password_actual, user.password_hash):
        raise HTTPException(400, "La contraseña actual es incorrecta")

    user.password_hash = hash_password(body.password_nueva)
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}


@router.get("/users")
def list_users(
    user: Usuario = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Listar usuarios (solo tecnico/autoridad)."""
    if user.rol not in ("tecnico", "autoridad"):
        raise HTTPException(403, "Sin permisos para ver usuarios")

    users = db.query(Usuario).filter(Usuario.activo == True).order_by(Usuario.created_at.desc()).all()
    return [u.to_dict() for u in users]
