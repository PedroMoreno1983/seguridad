import { useState } from 'react';
import {
  Settings, User, Moon, Sun, Bell, Shield, Database,
  Save, RefreshCw, ChevronRight, Globe, Map, Clock, BookOpen
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useComunas } from '@/hooks/useApi';

export function ConfiguracionPage() {
  const { user, theme, toggleTheme, selectedComuna, setSelectedComuna } = useAppStore();
  const { data: comunas } = useComunas();

  const [nombre, setNombre] = useState(user?.nombre || '');
  const [email, setEmail] = useState(user?.email || '');
  const [notifAlertas, setNotifAlertas] = useState(true);
  const [notifReportes, setNotifReportes] = useState(false);
  const [notifPredicciones, setNotifPredicciones] = useState(true);
  const [guardado, setGuardado] = useState(false);

  const handleGuardar = () => {
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  };

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          Configuración
        </h1>
        <p className="text-muted-foreground mt-2">
          Personaliza tu experiencia en SafeCity Analytics.
        </p>
      </div>

      {/* Perfil */}
      <Section title="Perfil de usuario" icon={User}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-2.5 bg-muted border border-border rounded-lg text-sm"
            />
          </Field>
          <Field label="Correo electrónico">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 bg-muted border border-border rounded-lg text-sm"
            />
          </Field>
        </div>
        <div className="mt-3">
          <span className="text-xs text-muted-foreground">Rol: </span>
          <span className="text-xs font-medium capitalize bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {user?.rol || 'autoridad'}
          </span>
        </div>
      </Section>

      {/* Apariencia */}
      <Section title="Apariencia" icon={theme === 'dark' ? Moon : Sun}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Tema de la interfaz</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Actualmente en modo {theme === 'dark' ? 'oscuro' : 'claro'}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              theme === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </Section>

      {/* Comuna por defecto */}
      <Section title="Ciudad y análisis" icon={Map}>
        <Field label="Comuna por defecto">
          <select
            value={selectedComuna?.id || ''}
            onChange={(e) => {
              const c = comunas?.find((x) => x.id === Number(e.target.value));
              if (c) setSelectedComuna(c);
            }}
            className="w-full p-2.5 bg-muted border border-border rounded-lg text-sm"
          >
            {comunas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Período de análisis por defecto">
          <select className="w-full p-2.5 bg-muted border border-border rounded-lg text-sm">
            <option value="3m">Últimos 3 meses</option>
            <option value="6m">Últimos 6 meses</option>
            <option value="12m" selected>Últimos 12 meses</option>
            <option value="24m">Últimos 2 años</option>
          </select>
        </Field>
      </Section>

      {/* Notificaciones */}
      <Section title="Notificaciones" icon={Bell}>
        <div className="space-y-4">
          <Toggle
            label="Alertas de zona de riesgo"
            description="Recibir alertas cuando se detectan zonas críticas"
            value={notifAlertas}
            onChange={setNotifAlertas}
          />
          <Toggle
            label="Reportes periódicos"
            description="Resumen semanal de estadísticas de la comuna"
            value={notifReportes}
            onChange={setNotifReportes}
          />
          <Toggle
            label="Nuevas predicciones"
            description="Notificar cuando se generan predicciones nuevas"
            value={notifPredicciones}
            onChange={setNotifPredicciones}
          />
        </div>
      </Section>

      {/* Sistema */}
      <Section title="Sistema" icon={Database}>
        <div className="space-y-3">
          <InfoRow label="Backend API" value={API_URL} icon={Globe} />
          <InfoRow label="Versión" value="1.0.0" icon={Shield} />
          <InfoRow label="Datos 1461 Peñalolén" value="2021 – 2025" icon={Clock} />
        </div>

        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
          <button
            onClick={() => {
              localStorage.removeItem('safecity_onboarding_done');
              window.location.reload();
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Ver tutorial de onboarding
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar caché de datos
          </button>
        </div>
      </Section>

      {/* Guardar */}
      <div className="flex justify-end">
        <button
          onClick={handleGuardar}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          {guardado ? (
            <>
              <span className="text-green-300">✓</span>
              Guardado
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Guardar cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Sub-componentes internos
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-1 text-sm font-medium">
        {value}
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
}
