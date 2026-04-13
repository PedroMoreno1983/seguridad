import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Map, Brain, Trophy, ChevronRight, ChevronLeft,
  X, LayoutDashboard, TrendingDown, Flame, Zap, BarChart3, Settings2
} from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    icon: Shield,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    title: 'Bienvenido a SafeCity Analytics',
    subtitle: 'Plataforma de análisis predictivo de seguridad pública',
    content: (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          SafeCity transforma datos reales de incidentes en <strong className="text-foreground">inteligencia accionable</strong> para tomar mejores decisiones en seguridad pública.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', desc: 'KPIs y tendencias' },
            { icon: Flame,           label: 'Mapa de calor', desc: 'Hotspots reales' },
            { icon: Brain,           label: 'Predicciones', desc: 'IA sobre zonas de riesgo' },
            { icon: Trophy,          label: 'Ranking',       desc: 'Comparativa de comunas' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
              <Icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">{label}</p>
                <p className="text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    route: null,
  },
  {
    id: 'comuna',
    icon: Settings2,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    title: 'Selecciona tu comuna',
    subtitle: 'Todo el análisis se filtra por la comuna activa',
    content: (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          En la barra lateral izquierda verás el selector de <strong className="text-foreground">COMUNA SELECCIONADA</strong>.
          Actualmente el sistema tiene datos reales de:
        </p>
        <div className="space-y-2">
          {[
            { nombre: 'Peñalolén', datos: '122.257 llamadas 1461 · 2021–2025', color: 'bg-blue-500/20 text-blue-400' },
            { nombre: 'La Granja', datos: '2.829 partes + 6.958 procedimientos 2025', color: 'bg-green-500/20 text-green-400' },
          ].map(({ nombre, datos, color }) => (
            <div key={nombre} className={`flex items-center justify-between p-3 rounded-lg ${color}`}>
              <span className="font-semibold">{nombre}</span>
              <span className="text-xs opacity-80">{datos}</span>
            </div>
          ))}
        </div>
        <p className="text-xs">
          Las demás comunas de la RM tienen datos de índices de seguridad para el Ranking, pero no datos de incidentes propios.
        </p>
      </div>
    ),
    route: null,
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    title: 'Dashboard',
    subtitle: 'Resumen ejecutivo de seguridad de la comuna',
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>El Dashboard muestra en tiempo real los principales indicadores de la comuna seleccionada:</p>
        <div className="space-y-2">
          {[
            { icon: '🛡️', label: 'Índice de seguridad', desc: 'Puntaje 0–100 basado en tasas delictuales históricas' },
            { icon: '📈', label: 'Evolución mensual', desc: 'Gráfico de incidentes mes a mes del último año de datos' },
            { icon: '🏆', label: 'Top 5 tipos de incidente', desc: 'Los tipos más frecuentes en la comuna' },
            { icon: '🔄', label: 'Tendencia', desc: '% de cambio respecto al mes anterior' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
              <span className="text-lg">{icon}</span>
              <div>
                <p className="font-medium text-foreground text-xs">{label}</p>
                <p className="text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    route: '/dashboard',
  },
  {
    id: 'mapa',
    icon: Flame,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    title: 'Mapa de Calor',
    subtitle: 'Visualización geoespacial de incidentes reales',
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>El mapa tiene <strong className="text-foreground">dos capas independientes</strong>:</p>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-red-500/10 border border-border">
            <p className="font-semibold text-foreground text-xs mb-1">🌡️ Mapa de calor</p>
            <p className="text-xs">Puntos reales de incidentes ponderados por gravedad. Azul → verde → amarillo → rojo según densidad.</p>
          </div>
          <div className="p-3 rounded-lg bg-orange-500/10 border border-border">
            <p className="font-semibold text-foreground text-xs mb-1">🟠 Zonas de riesgo</p>
            <p className="text-xs">Rectángulos generados por los modelos de IA desde la pestaña Predicciones. Se ubican en los hotspots con más incidentes históricos.</p>
          </div>
        </div>
        <p className="text-xs">Usa el panel lateral para filtrar por período o tipo de incidente.</p>
      </div>
    ),
    route: '/mapa',
  },
  {
    id: 'predicciones',
    icon: Brain,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    title: 'Predicciones con IA',
    subtitle: 'Modelos de Machine Learning para anticipar el delito',
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>El sistema ofrece <strong className="text-foreground">4 modelos predictivos</strong> basados en metodologías criminológicas internacionales:</p>
        <div className="space-y-2">
          {[
            { sigla: 'SEPP', color: 'text-blue-400', desc: 'Predice reincidencia espaciotemporal (delito atrae delito cercano)' },
            { sigla: 'RTM',  color: 'text-green-400', desc: 'Identifica territorios de riesgo según factores ambientales del entorno' },
            { sigla: 'XGB',  color: 'text-yellow-400', desc: 'Gradient boosting con variables históricas, temporales y geoespaciales' },
            { sigla: 'ENS',  color: 'text-purple-400', desc: 'Combina los 3 modelos ponderados → mayor precisión (92%)' },
          ].map(({ sigla, color, desc }) => (
            <div key={sigla} className="flex items-start gap-3">
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded bg-muted flex-shrink-0 ${color}`}>{sigla}</span>
              <p className="text-xs pt-0.5">{desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs">Las zonas generadas aparecen automáticamente en el Mapa de Calor.</p>
      </div>
    ),
    route: '/predicciones',
  },
  {
    id: 'ranking',
    icon: Trophy,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    title: 'Ranking de comunas',
    subtitle: 'Comparativa regional de seguridad',
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Compara el índice de seguridad de todas las comunas de la RM ordenadas de mayor a menor seguridad.</p>
        <div className="space-y-2">
          {[
            { emoji: '🏆', label: 'Más segura', nombre: 'Vitacura', valor: '88/100' },
            { emoji: '🥈', label: 'Segunda', nombre: 'Las Condes', valor: '85/100' },
            { emoji: '📊', label: 'Promedio RM', nombre: '~64 puntos', valor: '' },
          ].map(({ emoji, label, nombre, valor }) => (
            <div key={label} className="flex items-center justify-between p-2 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <span>{emoji}</span>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xs font-medium text-foreground">{nombre}</p>
                </div>
              </div>
              {valor && <span className="text-xs font-bold text-green-400">{valor}</span>}
            </div>
          ))}
        </div>
        <p className="text-xs">Puedes filtrar por región y ordenar por índice global, tasa delictual o percepción ciudadana.</p>
      </div>
    ),
    route: '/ranking',
  },
  {
    id: 'listo',
    icon: TrendingDown,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    title: '¡Listo para empezar!',
    subtitle: 'Empieza a analizar la seguridad de tu comuna',
    content: (
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>Tienes todo lo que necesitas para comenzar. Aquí un flujo recomendado:</p>
        <div className="space-y-2">
          {[
            '1. Selecciona tu comuna en el panel izquierdo',
            '2. Revisa el Dashboard para entender el panorama general',
            '3. Explora el Mapa de Calor para identificar zonas problemáticas',
            '4. Genera una predicción con el modelo Ensemble (más preciso)',
            '5. Las zonas de riesgo aparecerán en el Mapa de Calor',
            '6. Compara tu comuna con otras en el Ranking',
          ].map((paso) => (
            <div key={paso} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
              <span className="text-green-400 text-xs font-bold flex-shrink-0">→</span>
              <p className="text-xs">{paso}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-center pt-2">
          Puedes volver a ver este tutorial desde <strong className="text-foreground">Configuración → Ayuda</strong>
        </p>
      </div>
    ),
    route: '/dashboard',
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      navigate('/dashboard');
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => setStep((s) => Math.max(0, s - 1));

  const handleSkip = () => {
    onComplete();
    navigate('/dashboard');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          <div className={`inline-flex p-3 rounded-xl ${current.bg} mb-3`}>
            <Icon className={`h-6 w-6 ${current.color}`} />
          </div>

          <h2 className="text-xl font-bold">{current.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{current.subtitle}</p>
        </div>

        {/* Progress bar */}
        <div className="px-6">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right mt-1">
            {step + 1} / {STEPS.length}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto">
          {current.content}
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all ${
                i === step ? 'w-6 h-2 bg-primary' : 'w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Saltar tutorial
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-5 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              {isLast ? '¡Comenzar!' : 'Siguiente'}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
