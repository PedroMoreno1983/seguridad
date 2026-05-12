"""
Router de Autenticación
========================
Registro, login, perfil de usuario.
"""

import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.comuna import Comuna
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
    tipo_usuario: str = "territorial"        # territorial | organizacion
    rol: str = "ciudadano"                   # ciudadano | autoridad | tecnico | admin
    comuna_id: Optional[int] = None
    organizacion_id: Optional[int] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class DemoLoginRequest(BaseModel):
    tipo_usuario: str = "territorial"

class UpdateProfileRequest(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    comuna_id: Optional[int] = None
    organizacion_id: Optional[int] = None
    avatar_color: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str

class AdminUserUpdateRequest(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    tipo_usuario: Optional[str] = None
    comuna_id: Optional[int] = None
    organizacion_id: Optional[int] = None
    activo: Optional[bool] = None

class AdminPasswordResetRequest(BaseModel):
    password_nueva: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def _demo_access_enabled() -> bool:
    configured = os.getenv("SAFECITY_ENABLE_DEMO_ACCESS")
    if configured is None or configured.strip() == "":
        return True
    return configured.strip().lower() not in {"0", "false", "no", "off"}


def _demo_comuna_id(db: Session) -> int | None:
    comuna = db.query(Comuna).filter(Comuna.codigo_ine == "13122").first()
    if comuna:
        return comuna.id
    comuna = db.query(Comuna).order_by(Comuna.id.asc()).first()
    return comuna.id if comuna else None


def _upsert_demo_user(db: Session, tipo_usuario: str) -> Usuario:
    if tipo_usuario == "territorial":
        email = "demo.territorio@safecity.cl"
        defaults = {
            "nombre": "Demo Territorio",
            "rol": "admin",
            "tipo_usuario": "territorial",
            "comuna_id": _demo_comuna_id(db),
            "organizacion_id": None,
            "avatar_color": "#2563eb",
        }
    elif tipo_usuario == "organizacion":
        email = "demo.activos@safecity.cl"
        defaults = {
            "nombre": "Demo Activos",
            "rol": "manager",
            "tipo_usuario": "organizacion",
            "comuna_id": None,
            "organizacion_id": None,
            "avatar_color": "#111827",
        }
    else:
        raise HTTPException(400, "tipo_usuario invalido. Opciones: territorial, organizacion")

    user = db.query(Usuario).filter(Usuario.email == email).first()
    if not user:
        user = Usuario(
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            activo=True,
            **defaults,
        )
        db.add(user)
    else:
        for key, value in defaults.items():
            setattr(user, key, value)
        user.activo = True

    db.commit()
    db.refresh(user)
    return user


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Registrar nuevo usuario."""
    if body.tipo_usuario not in ("territorial", "organizacion"):
        raise HTTPException(400, "tipo_usuario inválido. Opciones: territorial, organizacion")

    roles_territoriales = ("ciudadano", "autoridad", "tecnico", "admin")
    roles_organizacion = ("viewer", "manager", "admin")
    roles_validos = roles_territoriales if body.tipo_usuario == "territorial" else roles_organizacion
    if body.rol not in roles_validos:
        raise HTTPException(400, f"Rol inválido para este tipo de usuario. Opciones: {', '.join(roles_validos)}")

    existing = db.query(Usuario).filter(Usuario.email == body.email).first()
    if existing:
        raise HTTPException(409, "Ya existe una cuenta con este correo electrónico")

    if body.tipo_usuario == "territorial":
        if body.comuna_id is None:
            raise HTTPException(400, "Debe seleccionar una comuna para cuentas territoriales")
        comuna = db.query(Comuna).filter(Comuna.id == body.comuna_id).first()
        if not comuna:
            raise HTTPException(404, "Comuna no encontrada")

    user = Usuario(
        nombre=body.nombre,
        email=body.email,
        password_hash=hash_password(body.password),
        tipo_usuario=body.tipo_usuario,
        rol=body.rol,
        comuna_id=body.comuna_id if body.tipo_usuario == "territorial" else None,
        organizacion_id=body.organizacion_id if body.tipo_usuario == "organizacion" else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

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


@router.post("/demo-login", response_model=TokenResponse)
def demo_login(body: DemoLoginRequest, db: Session = Depends(get_db)):
    """Emitir token de demostracion sin exponer credenciales compartidas."""
    if not _demo_access_enabled():
        raise HTTPException(403, "Acceso demo deshabilitado")

    user = _upsert_demo_user(db, body.tipo_usuario)
    token = create_access_token({"sub": user.id, "rol": user.rol, "demo": True})
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
    if body.organizacion_id is not None:
        user.organizacion_id = body.organizacion_id
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
    """Listar usuarios administrables."""
    if user.rol not in ("tecnico", "admin"):
        raise HTTPException(403, "Sin permisos para ver usuarios")

    users = db.query(Usuario).order_by(Usuario.created_at.desc()).all()
    return [u.to_dict() for u in users]


@router.patch("/users/{user_id}")
def update_user_admin(
    user_id: int,
    body: AdminUserUpdateRequest,
    current_user: Usuario = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Actualizar usuario desde administracion comercial."""
    if current_user.rol not in ("tecnico", "admin"):
        raise HTTPException(403, "Sin permisos para administrar usuarios")
    target = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    if target.id == current_user.id and body.activo is False:
        raise HTTPException(400, "No puede desactivar su propia cuenta")

    if body.nombre is not None:
        target.nombre = body.nombre.strip() or target.nombre
    if body.rol is not None:
        roles_validos = ("ciudadano", "autoridad", "tecnico", "admin", "viewer", "manager")
        if body.rol not in roles_validos:
            raise HTTPException(400, "Rol invalido")
        target.rol = body.rol
    if body.tipo_usuario is not None:
        if body.tipo_usuario not in ("territorial", "organizacion"):
            raise HTTPException(400, "tipo_usuario invalido")
        target.tipo_usuario = body.tipo_usuario
    if body.comuna_id is not None:
        comuna = db.query(Comuna).filter(Comuna.id == body.comuna_id).first()
        if not comuna:
            raise HTTPException(404, "Comuna no encontrada")
        target.comuna_id = body.comuna_id
    if body.organizacion_id is not None:
        target.organizacion_id = body.organizacion_id
    if body.activo is not None:
        target.activo = body.activo

    db.commit()
    db.refresh(target)
    return target.to_dict()


@router.post("/users/{user_id}/reset-password")
def reset_user_password_admin(
    user_id: int,
    body: AdminPasswordResetRequest,
    current_user: Usuario = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Resetear contrasena de un usuario desde administracion."""
    if current_user.rol not in ("tecnico", "admin"):
        raise HTTPException(403, "Sin permisos para administrar usuarios")
    if len(body.password_nueva) < 8:
        raise HTTPException(400, "La nueva contrasena debe tener al menos 8 caracteres")
    target = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    target.password_hash = hash_password(body.password_nueva)
    db.commit()
    return {"message": "Contrasena actualizada"}
