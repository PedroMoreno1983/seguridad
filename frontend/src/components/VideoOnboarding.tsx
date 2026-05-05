import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, X, Volume2 } from 'lucide-react';

// ── Cada "escena" del video ───────────────────────────────────────────────────
const SCENES = [
  {
    id: 'intro',
    duracion: 5,
    titulo: 'SafeCity Analytics',
    subtitulo: 'Plataforma de seguridad pública basada en datos reales',
    narracion: 'Bienvenido a SafeCity Analytics — la herramienta que transforma datos de emergencias e incidentes reales en inteligencia accionable para las decisiones de seguridad pública.',
    bg: 'from-slate-900 via-blue-950 to-slate-900',
    visual: (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="p-5 bg-blue-500/20 rounded-2xl border border-blue-500/30 animate-pulse">
          <svg className="w-16 h-16 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 01.75 12c0 6.627 5.373 12 12 12 6.628 0 12-5.373 12-12 0-2.552-.797-4.917-2.148-6.857m1.148 6.857L9 12.75" />
          </svg>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {['Datos reales', 'IA predictiva', 'Mapas de calor'].map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {tag}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'datos',
    duracion: 6,
    titulo: 'Datos reales cargados',
    subtitulo: 'Dos comunas con información histórica',
    narracion: 'El sistema tiene cargados datos reales de dos comunas. Peñalolén con 122 mil llamadas al 1461 entre 2021 y 2025, y La Granja con casi 10 mil registros de seguridad pública de 2022 a 2025.',
    bg: 'from-slate-900 via-emerald-950 to-slate-900',
    visual: (
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        <div className="p-3 rounded-xl border bg-blue-500/10 border-blue-500/30">
          <p className="text-blue-400 font-bold text-lg">122.257</p>
          <p className="text-white font-semibold text-sm mt-1">Peñalolén</p>
          <p className="text-gray-400 text-xs">Llamadas 1461</p>
          <p className="text-gray-500 text-xs">2021–2025</p>
        </div>
        <div className="p-3 rounded-xl border bg-green-500/10 border-green-500/30">
          <p className="text-green-400 font-bold text-lg">9.787</p>
          <p className="text-white font-semibold text-sm mt-1">La Granja</p>
          <p className="text-gray-400 text-xs">Partes + Proced.</p>
          <p className="text-gray-500 text-xs">2022–2025</p>
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard',
    duracion: 6,
    titulo: 'Dashboard de Seguridad',
    subtitulo: 'KPIs y tendencias en tiempo real',
    narracion: 'El Dashboard muestra los indicadores clave de la comuna seleccionada: el índice de seguridad, la evolución mensual de incidentes, los tipos más frecuentes y la tendencia respecto al mes anterior.',
    bg: 'from-slate-900 via-indigo-950 to-slate-900',
    visual: (
      <div className="w-full max-w-xs space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
            <p className="text-gray-400 text-[10px]">Índice Seguridad</p>
            <p className="font-bold text-base text-yellow-400">67.5</p>
          </div>
          <div className="p-2.5 rounded-lg border bg-orange-500/10 border-orange-500/20">
            <p className="text-gray-400 text-[10px]">Total delitos (12m)</p>
            <p className="font-bold text-base text-orange-400">3.847</p>
          </div>
          <div className="p-2.5 rounded-lg border bg-green-500/10 border-green-500/20">
            <p className="text-gray-400 text-[10px]">Tendencia mensual</p>
            <p className="font-bold text-base text-green-400">-9.7%</p>
          </div>
          <div className="p-2.5 rounded-lg border bg-blue-500/10 border-blue-500/20">
            <p className="text-gray-400 text-[10px]">Población</p>
            <p className="font-bold text-base text-blue-400">241.599</p>
          </div>
        </div>
        <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-gray-400 text-[10px] mb-1.5">Evolución mensual</p>
          <div className="flex items-end gap-1 h-8">
            {[40, 55, 60, 45, 70, 65, 50, 75, 60, 45, 40, 35].map((h, i) => (
              <div key={i} className="flex-1 bg-blue-500/60 rounded-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'indice',
    duracion: 7,
    titulo: 'Índice de Seguridad',
    subtitulo: 'Escala 0–100 basada en 5 componentes',
    narracion: 'El índice de seguridad combina cinco dimensiones: la tasa delictual por 100 mil habitantes, la percepción ciudadana de seguridad, la tasa de victimización, el índice de temor, y la capacidad de prevención. A mayor puntaje, más segura es la comuna.',
    bg: 'from-slate-900 via-purple-950 to-slate-900',
    visual: (
      <div className="w-full max-w-xs space-y-2">
        {[
          { label: 'Tasa delictual', peso: '30%', valor: 72, color: 'bg-blue-500' },
          { label: 'Percepción ciudadana', peso: '25%', valor: 62, color: 'bg-purple-500' },
          { label: 'Victimización', peso: '20%', valor: 58, color: 'bg-pink-500' },
          { label: 'Índice de temor', peso: '15%', valor: 55, color: 'bg-orange-500' },
          { label: 'Cap. prevención', peso: '10%', valor: 80, color: 'bg-green-500' },
        ].map(({ label, peso, valor, color }) => (
          <div key={label}>
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>{label}</span>
              <span className="text-gray-500">{peso} · <strong className="text-white">{valor}/100</strong></span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${valor}%` }} />
            </div>
          </div>
        ))}
        <div className="pt-2 mt-1 border-t border-slate-700 flex justify-between items-center">
          <span className="text-gray-400 text-xs">Índice compuesto</span>
          <span className="text-yellow-400 font-bold text-lg">67.5 / 100</span>
        </div>
      </div>
    ),
  },
  {
    id: 'mapa',
    duracion: 6,
    titulo: 'Mapa de Calor',
    subtitulo: 'Geolocalización de incidentes reales',
    narracion: 'El mapa de calor muestra todos los incidentes reales georeferenciados. Los colores van de azul para zonas de baja densidad hasta rojo intenso para los hotspots con mayor concentración de delitos.',
    bg: 'from-slate-900 via-red-950 to-slate-900',
    visual: (
      <div className="relative w-full max-w-xs h-36 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
        <div className="absolute inset-0 opacity-30"
          style={{ background: 'repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,0.03) 20px,rgba(255,255,255,0.03) 21px),repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,0.03) 20px,rgba(255,255,255,0.03) 21px)' }} />
        {[
          { x: 45, y: 35, r: 50, color: 'rgba(239,68,68,0.7)' },
          { x: 65, y: 55, r: 35, color: 'rgba(249,115,22,0.6)' },
          { x: 30, y: 60, r: 30, color: 'rgba(234,179,8,0.5)' },
          { x: 70, y: 30, r: 25, color: 'rgba(234,179,8,0.4)' },
          { x: 50, y: 75, r: 20, color: 'rgba(59,130,246,0.4)' },
        ].map((h, i) => (
          <div key={i} className="absolute rounded-full animate-pulse"
            style={{
              left: `${h.x}%`, top: `${h.y}%`,
              width: `${h.r}px`, height: `${h.r}px`,
              background: `radial-gradient(circle, ${h.color}, transparent)`,
              transform: 'translate(-50%,-50%)',
              animationDelay: `${i * 0.3}s`,
            }} />
        ))}
        <div className="absolute bottom-2 left-2 text-[10px] text-white/60 bg-black/40 px-2 py-0.5 rounded">
          26.434 puntos · Peñalolén
        </div>
      </div>
    ),
  },
  {
    id: 'predicciones',
    duracion: 7,
    titulo: 'Predicciones con IA',
    subtitulo: '4 modelos · Zonas de riesgo · Horizonte temporal',
    narracion: 'El módulo de predicciones usa cuatro modelos de Machine Learning para anticipar dónde es más probable que ocurran delitos. El horizonte de predicción es el período futuro que analiza, desde 24 hasta 168 horas.',
    bg: 'from-slate-900 via-violet-950 to-slate-900',
    visual: (
      <div className="w-full max-w-xs space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg border bg-blue-500/10 border-blue-500/20">
            <p className="text-blue-400 font-mono text-[10px] font-bold">SEPP</p>
            <p className="text-white text-[10px] leading-tight">Self-Exciting Point Process</p>
            <p className="text-blue-300 font-bold text-xs mt-0.5">89%</p>
          </div>
          <div className="p-2 rounded-lg border bg-green-500/10 border-green-500/20">
            <p className="text-green-400 font-mono text-[10px] font-bold">RTM</p>
            <p className="text-white text-[10px] leading-tight">Risk Terrain Modeling</p>
            <p className="text-green-300 font-bold text-xs mt-0.5">75%</p>
          </div>
          <div className="p-2 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
            <p className="text-yellow-400 font-mono text-[10px] font-bold">XGB</p>
            <p className="text-white text-[10px] leading-tight">XGBoost Espacial</p>
            <p className="text-yellow-300 font-bold text-xs mt-0.5">85%</p>
          </div>
          <div className="p-2 rounded-lg border bg-purple-500/10 border-purple-500/20">
            <p className="text-purple-400 font-mono text-[10px] font-bold">ENS</p>
            <p className="text-white text-[10px] leading-tight">Ensemble (recomendado)</p>
            <p className="text-purple-300 font-bold text-xs mt-0.5">92%</p>
          </div>
        </div>
        <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700 text-[10px] space-y-0.5">
          <div className="flex justify-between text-gray-400">
            <span>Horizonte predicción</span><strong className="text-white">72 horas</strong>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Zonas de riesgo</span><strong className="text-orange-400">5 zonas</strong>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'flujo',
    duracion: 6,
    titulo: 'Flujo de trabajo',
    subtitulo: 'Cómo usar SafeCity en la práctica',
    narracion: 'El flujo recomendado: selecciona tu comuna, revisa el Dashboard para entender el contexto, explora el Mapa de Calor para ver los hotspots, genera una predicción con el modelo Ensemble y las zonas de riesgo aparecerán en el mapa.',
    bg: 'from-slate-900 via-cyan-950 to-slate-900',
    visual: (
      <div className="w-full max-w-xs">
        <div className="flex flex-col gap-1.5">
          {[
            { n: 1, texto: 'Selecciona tu comuna', color: 'border-blue-500/40 bg-blue-500/10' },
            { n: 2, texto: 'Dashboard: revisa KPIs y tendencias', color: 'border-indigo-500/40 bg-indigo-500/10' },
            { n: 3, texto: 'Mapa: identifica hotspots reales', color: 'border-orange-500/40 bg-orange-500/10' },
            { n: 4, texto: 'Predicciones: genera con Ensemble', color: 'border-purple-500/40 bg-purple-500/10' },
            { n: 5, texto: 'Mapa: zonas de riesgo predichas', color: 'border-red-500/40 bg-red-500/10' },
          ].map(({ n, texto, color }) => (
            <div key={n} className={`flex items-center gap-2.5 p-2 rounded-lg border ${color}`}>
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{n}</div>
              <span className="text-xs text-white/80">{texto}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const SCENES_ACTIVOS = [
  {
    id: 'intro',
    duracion: 5,
    titulo: 'Atalaya Activos',
    subtitulo: 'Seguridad privada basada en datos reales',
    narracion: 'Bienvenido a Atalaya Activos — la plataforma que centraliza la seguridad patrimonial de tu organización: sedes, incidentes, pérdidas y continuidad operacional en un solo lugar.',
    bg: 'from-slate-900 via-slate-800 to-slate-900',
    visual: (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="p-5 bg-white/10 rounded-2xl border border-white/20 animate-pulse">
          <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {['Sedes', 'Incidentes', 'Pérdidas', 'Perfilamiento'].map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/20">{tag}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'sedes',
    duracion: 6,
    titulo: 'Sedes cargadas',
    subtitulo: '3 sedes activas en Santiago',
    narracion: 'El sistema tiene cargadas 3 sedes operativas: Tienda La Granja, Tienda Peñalolén y Bodega Pudahuel. Cada sede tiene sus zonas internas y activos críticos definidos.',
    bg: 'from-slate-900 via-amber-950 to-slate-900',
    visual: (
      <div className="w-full max-w-xs space-y-2">
        {[
          { nombre: 'Tienda La Granja',   comuna: 'La Granja',  tipo: 'Tienda', color: 'border-amber-500/30 bg-amber-500/10', tc: 'text-amber-400' },
          { nombre: 'Tienda Peñalolén',   comuna: 'Peñalolén',  tipo: 'Tienda', color: 'border-blue-500/30 bg-blue-500/10',   tc: 'text-blue-400' },
          { nombre: 'Bodega Pudahuel',    comuna: 'Pudahuel',   tipo: 'Bodega', color: 'border-green-500/30 bg-green-500/10', tc: 'text-green-400' },
        ].map((s) => (
          <div key={s.nombre} className={`flex items-center justify-between rounded-lg border p-2.5 ${s.color}`}>
            <div>
              <p className={`text-xs font-bold ${s.tc}`}>{s.nombre}</p>
              <p className="text-[10px] text-white/50">{s.comuna}</p>
            </div>
            <span className="text-[10px] text-white/40 border border-white/10 rounded px-1.5 py-0.5">{s.tipo}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'incidentes',
    duracion: 6,
    titulo: 'Registro de incidentes',
    subtitulo: '20 incidentes · $2.4M en pérdidas',
    narracion: 'El briefing muestra los incidentes del período con su tipo, zona, severidad y pérdida estimada. Los tipos más frecuentes son hurto y robo con fuerza. Puedes cargar tus propios datos vía CSV o integración.',
    bg: 'from-slate-900 via-red-950 to-slate-900',
    visual: (
      <div className="w-full max-w-xs space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Hurtos', valor: '9', color: 'text-orange-400' },
            { label: 'Robos', valor: '3', color: 'text-red-400' },
            { label: 'Fraude', valor: '2', color: 'text-purple-400' },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
              <p className={`text-lg font-bold ${k.color}`}>{k.valor}</p>
              <p className="text-[10px] text-white/50">{k.label}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
          <p className="text-[10px] text-white/50 mb-1">Pérdidas estimadas totales</p>
          <p className="text-lg font-bold text-red-400">$2.487.000 CLP</p>
        </div>
      </div>
    ),
  },
  {
    id: 'perfilamiento',
    duracion: 7,
    titulo: 'Perfilamiento de operación',
    subtitulo: 'Define tu vertical y activos críticos',
    narracion: 'El perfilamiento es el primer paso. Selecciona tu vertical de negocio — retail, logística, clínica, colegio — e identifica los activos críticos de cada sede. Esto calibra las alertas y el análisis de riesgo.',
    bg: 'from-slate-900 via-indigo-950 to-slate-900',
    visual: (
      <div className="w-full max-w-xs space-y-2">
        {['Retail', 'Logística', 'Clínica', 'Colegio', 'Condominio', 'Industria'].map((v, i) => (
          <div key={v} className={`flex items-center gap-2 rounded-lg border p-2 ${i === 0 ? 'border-indigo-500/50 bg-indigo-500/15' : 'border-white/10 bg-white/5'}`}>
            <div className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-indigo-400' : 'bg-white/20'}`} />
            <span className={`text-xs ${i === 0 ? 'text-white font-medium' : 'text-white/50'}`}>{v}</span>
            {i === 0 && <span className="ml-auto text-[10px] text-indigo-400 border border-indigo-500/30 rounded px-1">Activo</span>}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'carga',
    duracion: 6,
    titulo: 'Carga de datos',
    subtitulo: 'CSV o integración directa',
    narracion: 'Puedes cargar tus incidentes históricos mediante CSV en la sección Carga CSV. El sistema acepta archivos de sistemas de gestión de pérdidas, cámaras o reportes de guardias. También soporta integración con VMS y POS.',
    bg: 'from-slate-900 via-cyan-950 to-slate-900',
    visual: (
      <div className="w-full max-w-xs space-y-2">
        {[
          { label: 'Carga CSV manual', desc: 'Reportes guardias / ERP / POS', ok: true },
          { label: 'Integración VMS', desc: 'Milestone, Avigilon, Hikvision', ok: false },
          { label: 'Integración POS', desc: 'SAP Retail, Oracle', ok: false },
          { label: 'API REST', desc: 'Webhooks en tiempo real', ok: false },
        ].map((f) => (
          <div key={f.label} className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${f.ok ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-white/10 bg-white/5'}`}>
            <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${f.ok ? 'bg-cyan-400' : 'bg-white/20'}`} />
            <div>
              <p className={`text-xs font-medium ${f.ok ? 'text-white' : 'text-white/50'}`}>{f.label}</p>
              <p className="text-[10px] text-white/40">{f.desc}</p>
            </div>
            {f.ok && <span className="ml-auto text-[10px] text-cyan-400">Disponible</span>}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'flujo',
    duracion: 6,
    titulo: 'Flujo de trabajo',
    subtitulo: 'Cómo usar Atalaya Activos',
    narracion: 'El flujo recomendado: configura el perfilamiento, carga tus datos históricos, revisa el briefing con incidentes y pérdidas, analiza las fuentes privadas disponibles y define integraciones con tu equipo técnico.',
    bg: 'from-slate-900 via-slate-800 to-slate-900',
    visual: (
      <div className="w-full max-w-xs">
        <div className="flex flex-col gap-1.5">
          {[
            { n: 1, texto: 'Perfilamiento: define vertical y activos', color: 'border-indigo-500/40 bg-indigo-500/10' },
            { n: 2, texto: 'Carga CSV: sube incidentes históricos', color: 'border-cyan-500/40 bg-cyan-500/10' },
            { n: 3, texto: 'Briefing: revisa incidentes y pérdidas', color: 'border-amber-500/40 bg-amber-500/10' },
            { n: 4, texto: 'Fuentes: activa integraciones externas', color: 'border-purple-500/40 bg-purple-500/10' },
            { n: 5, texto: 'Analítica: riesgo territorial por sede', color: 'border-red-500/40 bg-red-500/10' },
          ].map(({ n, texto, color }) => (
            <div key={n} className={`flex items-center gap-2.5 p-2 rounded-lg border ${color}`}>
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{n}</div>
              <span className="text-xs text-white/80">{texto}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

interface VideoOnboardingProps {
  onComplete: () => void;
  tipoUsuario?: 'territorial' | 'organizacion';
}

export function VideoOnboarding({ onComplete, tipoUsuario = 'territorial' }: VideoOnboardingProps) {
  const SCENES_ACTIVO = tipoUsuario === 'organizacion' ? SCENES_ACTIVOS : SCENES;
  const [sceneIdx, setSceneIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scene = SCENES_ACTIVO[sceneIdx];
  const totalDuracion = SCENES_ACTIVO.reduce((a, s) => a + s.duracion, 0);
  const tiempoAnterior = SCENES_ACTIVO.slice(0, sceneIdx).reduce((a, s) => a + s.duracion, 0);
  const globalProgress = ((tiempoAnterior + (progress / 100) * scene.duracion) / totalDuracion) * 100;

  const palabras = scene.narracion.split(' ');

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    setWordIdx(0);
    if (wordRef.current) clearInterval(wordRef.current);
    if (!playing) return;
    const velocidad = (scene.duracion * 1000) / palabras.length;
    wordRef.current = setInterval(() => {
      setWordIdx(i => {
        if (i >= palabras.length - 1) {
          if (wordRef.current) clearInterval(wordRef.current);
          return palabras.length - 1;
        }
        return i + 1;
      });
    }, velocidad);
    return () => { if (wordRef.current) clearInterval(wordRef.current); };
  }, [sceneIdx, playing]);

  useEffect(() => {
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!playing) return;
    const step = 100 / (scene.duracion * 20);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p + step >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            if (sceneIdx < SCENES_ACTIVO.length - 1) {
              setSceneIdx(i => i + 1);
            } else {
              handleComplete();
            }
          }, 300);
          return 100;
        }
        return p + step;
      });
    }, 50);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [sceneIdx, playing]);

  const handleSkipScene = () => {
    if (sceneIdx < SCENES_ACTIVO.length - 1) setSceneIdx(i => i + 1);
    else handleComplete();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const tiempoTotal = pct * totalDuracion;
    let acc = 0;
    for (let i = 0; i < SCENES.length; i++) {
      if (acc + SCENES[i].duracion >= tiempoTotal) {
        setSceneIdx(i);
        setProgress(((tiempoTotal - acc) / SCENES[i].duracion) * 100);
        return;
      }
      acc += SCENES[i].duracion;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-3">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col"
        style={{ maxHeight: '90vh' }}>

        {/* Visual */}
        <div className={`relative bg-gradient-to-br ${scene.bg} flex flex-col items-center justify-center p-6 min-h-[280px]`}>
          <button onClick={handleComplete}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors z-10">
            <X className="h-4 w-4" />
          </button>
          <div className="absolute top-3 left-3 flex gap-1">
            {SCENES_ACTIVO.map((_, i) => (
              <button key={i} onClick={() => setSceneIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === sceneIdx ? 'w-6 bg-white' : i < sceneIdx ? 'w-3 bg-white/50' : 'w-3 bg-white/20'}`} />
            ))}
          </div>

          <div className="flex items-center justify-center w-full flex-1 py-2">
            {scene.visual}
          </div>

          <div className="text-center mt-2">
            <h2 className="text-white font-bold text-lg">{scene.titulo}</h2>
            <p className="text-white/50 text-xs mt-0.5">{scene.subtitulo}</p>
          </div>
        </div>

        {/* Narración + controles */}
        <div className="bg-slate-950 px-4 py-3 space-y-2 flex-shrink-0">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Volume2 className="h-3 w-3 text-white" />
            </div>
            <p className="text-xs text-white/90 leading-relaxed line-clamp-3">
              {palabras.map((palabra, i) => (
                <span key={i} className={`transition-colors duration-200 ${i <= wordIdx ? 'text-white' : 'text-white/25'}`}>
                  {palabra}{' '}
                </span>
              ))}
            </p>
          </div>

          <div className="cursor-pointer" onClick={handleSeek}>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden hover:h-1.5 transition-all">
              <div className="h-full bg-blue-500 rounded-full transition-none" style={{ width: `${globalProgress}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setPlaying(p => !p)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button onClick={handleSkipScene}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <span className="text-white/40 text-xs">{sceneIdx + 1} / {SCENES_ACTIVO.length}</span>
            </div>
            <button onClick={handleComplete} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Saltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
