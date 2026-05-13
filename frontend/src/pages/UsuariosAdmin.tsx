import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, KeyRound, Loader2, Search, Shield, Users } from 'lucide-react';
import { useActualizarUsuarioAdmin, useComunas, useResetPasswordAdmin, useUsuariosAdmin } from '@/hooks/useApi';
import type { User, UserRole } from '@/types';

const ROLES: UserRole[] = ['ciudadano', 'autoridad', 'tecnico', 'admin'];

export function UsuariosAdminPage() {
  const { data: usuarios, isLoading, isError } = useUsuariosAdmin();
  const { data: comunas } = useComunas();
  const actualizar = useActualizarUsuarioAdmin();
  const resetPassword = useResetPasswordAdmin();
  const [busqueda, setBusqueda] = useState('');
  const [passwords, setPasswords] = useState<Record<number, string>>({});
  const [okMessage, setOkMessage] = useState('');

  const usuariosFiltrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    if (!query) return usuarios || [];
    return (usuarios || []).filter((usuario) =>
      [usuario.nombre, usuario.email, usuario.rol, usuario.tipo_usuario]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [busqueda, usuarios]);

  const comunaNombre = (user: User) => {
    const comuna = comunas?.find((item) => item.id === user.comuna_id);
    return comuna?.nombre || 'Sin comuna';
  };

  const updateUser = async (userId: number, payload: Partial<User>) => {
    setOkMessage('');
    await actualizar.mutateAsync({ userId, payload });
    setOkMessage('Usuario actualizado');
  };

  const handleReset = async (userId: number) => {
    const password = passwords[userId]?.trim();
    if (!password || password.length < 8) return;
    setOkMessage('');
    await resetPassword.mutateAsync({ userId, password });
    setPasswords((current) => ({ ...current, [userId]: '' }));
    setOkMessage('Contraseña actualizada');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold md:text-3xl">
            <Users className="h-8 w-8 text-primary" />
            Administración de usuarios
          </h1>
          <p className="mt-2 text-muted-foreground">
            Gestion operativa de cuentas municipales, roles y acceso territorial.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar usuario"
            className="w-full rounded-sm border border-border bg-card py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {okMessage && (
        <div className="flex items-center gap-2 rounded-sm border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          {okMessage}
        </div>
      )}

      {(actualizar.isError || resetPassword.isError || isError) && (
        <div className="flex items-center gap-2 rounded-sm border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          No fue posible completar la operacion.
        </div>
      )}

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <div className="min-w-[920px]">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
          <span>Usuario</span>
          <span>Rol</span>
          <span>Comuna</span>
          <span>Estado</span>
          <span>Reset</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando usuarios...
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hay usuarios para mostrar.
          </div>
        ) : (
          usuariosFiltrados.map((usuario) => (
            <div key={usuario.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{usuario.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
              </div>

              <select
                value={usuario.rol}
                onChange={(event) => updateUser(usuario.id, { rol: event.target.value as UserRole })}
                className="rounded-sm border border-border bg-background px-2 py-2 text-sm"
              >
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>{rol}</option>
                ))}
              </select>

              <select
                value={usuario.comuna_id || ''}
                onChange={(event) => updateUser(usuario.id, { comuna_id: Number(event.target.value) })}
                className="rounded-sm border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="">{comunaNombre(usuario)}</option>
                {(comunas || []).map((comuna) => (
                  <option key={comuna.id} value={comuna.id}>{comuna.nombre}</option>
                ))}
              </select>

              <button
                onClick={() => updateUser(usuario.id, { activo: !usuario.activo })}
                className={`inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  usuario.activo
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                <Shield className="h-3 w-3" />
                {usuario.activo ? 'Activo' : 'Inactivo'}
              </button>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={passwords[usuario.id] || ''}
                  onChange={(event) => setPasswords((current) => ({ ...current, [usuario.id]: event.target.value }))}
                  placeholder="Nueva contrasena"
                  className="min-w-0 flex-1 rounded-sm border border-border bg-background px-2 py-2 text-sm"
                />
                <button
                  onClick={() => handleReset(usuario.id)}
                  disabled={(passwords[usuario.id] || '').trim().length < 8 || resetPassword.isPending}
                  className="rounded-sm bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
                  title="Actualizar contrasena"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
}
