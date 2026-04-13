import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
      <div className="flex flex-col items-center justify-center gap-6">
        <div className="p-6 bg-blue-500/20 rounded-2xl border border-blue-500/30 animate-pulse">
          <svg className="w-20 h-20 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 01.75 12c0 6.627 5.373 12 12 12 6.628 0 12-5.373 12-12 0-2.552-.797-4.917-2.148-6.857m1.148 6.857L9 12.75" />
          </svg>
        </div>
        <div className="flex gap-3">
          {['Datos reales', 'IA predictiva', 'Mapas de calor'].map((tag, i) => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"
              style={{ animationDelay: `${i * 0.2}s` }}>
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
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        {[
          { nombre: 'Peñalolén', registros: '122.257', tipo: 'Llamadas 1461', color: 'blue', años: '2021–2025' },
          { nombre: 'La Granja', registros: '9.787', tipo: 'Partes + Procedimientos', color: 'green', años: '2022–2025' },
        ].map(({ nombre, registros, tipo, color, años }) => (
          <div key={nombre} className={`p-4 rounded-xl border bg-${color}-500/10 border-${color}-500/30`}>
            <p className={`text-${color}-400 font-bold text-lg`}>{registros}</p>
            <p className="text-white font-semibold text-sm mt-1">{nombre}</p>
            <p className="text-gray-400 text-xs">{tipo}</p>
            <p className="text-gray-500 text-xs">{años}</p>
          </div>
        ))}
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
      <div className="w-full max-w-md space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Índice Seguridad', valor: '67.5', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
            { label: 'Total delitos (12m)', valor: '3.847', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
            { label: 'Tendencia mensual', valor: '-9.7%', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
            { label: 'Población', valor: '241.599', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          ].map(({ label, valor, color, bg }) => (
            <div key={label} className={`p-3 rounded-lg border ${bg}`}>
              <p className="text-gray-400 text-xs">{label}</p>
              <p className={`font-bold text-lg ${color}`}>{valor}</p>
            </div>
          ))}
        </div>
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-gray-400 text-xs mb-2">Evolución mensual</p>
          <div className="flex items-end gap-1 h-10">
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
    titulo: '¿Cómo se calcula el Índice de Seguridad?',
    subtitulo: 'Escala 0–100 basada en 5 componentes',
    narracion: 'El índice de seguridad combina cinco dimensiones: la tasa delictual por 100 mil habitantes, la percepción ciudadana de seguridad, la tasa de victimización, el índice de temor, y la capacidad de prevención de la comunidad. A mayor puntaje, más segura es la comuna.',
    bg: 'from-slate-900 via-purple-950 to-slate-900',
    visual: (
      <div className="w-full max-w-sm space-y-2">
        {[
          { label: 'Tasa delictual', peso: '30%', valor: 72, color: 'bg-blue-500' },
          { label: 'Percepción ciudadana', peso: '25%', valor: 62, color: 'bg-purple-500' },
          { label: 'Victimización', peso: '20%', valor: 58, color: 'bg-pink-500' },
          { label: 'Índice de temor', peso: '15%', valor: 55, color: 'bg-orange-500' },
          { label: 'Capacidad prevención', peso: '10%', valor: 80, color: 'bg-green-500' },
        ].map(({ label, peso, valor, color }) => (
          <div key={label}>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{label}</span>
              <span className="text-gray-500">{peso} · <strong className="text-white">{valor}/100</strong></span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${valor}%` }} />
            </div>
          </div>
        ))}
        <div className="pt-2 mt-2 border-t border-slate-700 flex justify-between items-center">
          <span className="text-gray-400 text-xs">Índice compuesto</span>
          <span className="text-yellow-400 font-bold text-xl">67.5 / 100</span>
        </div>
      </div>
    ),
  },
  {
    id: 'mapa',
    duracion: 6,
    titulo: 'Mapa de Calor',
    subtitulo: 'Geolocalización de incidentes reales',
    narracion: 'El mapa de calor muestra todos los incidentes reales georeferenciados. Los colores van de azul para zonas de baja densidad hasta rojo intenso para los hotspots con mayor concentración de delitos. Los puntos más graves tienen mayor peso visual.',
    bg: 'from-slate-900 via-red-950 to-slate-900',
    visual: (
      <div className="relative w-full max-w-sm h-44 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
        {/* Mapa simulado */}
        <div className="absolute inset-0 opacity-30"
          style={{ background: 'repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,0.03) 20px,rgba(255,255,255,0.03) 21px),repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,0.03) 20px,rgba(255,255,255,0.03) 21px)' }} />
        {/* Hotspots */}
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
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-white/60 bg-black/40 px-2 py-1 rounded">
          <span>26.434 puntos · Peñalolén</span>
        </div>
      </div>
    ),
  },
  {
    id: 'predicciones',
    duracion: 7,
    titulo: 'Predicciones con IA',
    subtitulo: '4 modelos · Zonas de riesgo · Horizonte temporal',
    narracion: 'El módulo de predicciones usa cuatro modelos de Machine Learning para anticipar dónde es más probable que ocurran delitos. El horizonte de predicción es el período futuro que el modelo analiza, desde 24 hasta 168 horas. Las zonas generadas aparecen directamente en el mapa de calor.',
    bg: 'from-slate-900 via-violet-950 to-slate-900',
    visual: (
      <div className="w-full max-w-sm space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'SEPP', label: 'Self-Exciting Point Process', ef: '89%', color: 'blue' },
            { id: 'RTM', label: 'Risk Terrain Modeling', ef: '75%', color: 'green' },
            { id: 'XGB', label: 'XGBoost Espacial', ef: '85%', color: 'yellow' },
            { id: 'ENS', label: 'Ensemble (recomendado)', ef: '92%', color: 'purple' },
          ].map(({ id, label, ef, color }) => (
            <div key={id} className={`p-2 rounded-lg border bg-${color}-500/10 border-${color}-500/20`}>
              <p className={`text-${color}-400 font-mono text-xs font-bold`}>{id}</p>
              <p className="text-white text-xs mt-0.5 leading-tight">{label}</p>
              <p className={`text-${color}-300 font-bold text-sm mt-1`}>{ef}</p>
            </div>
          ))}
        </div>
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-xs space-y-1">
          <div className="flex justify-between text-gray-400">
            <span>Horizonte de predicción</span><strong className="text-white">72 horas</strong>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Zonas de riesgo</span><strong className="text-orange-400">5 zonas críticas</strong>
          </div>
          <p className="text-gray-500 text-xs pt-1">Las zonas se ubican sobre los hotspots reales del mapa.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'flujo',
    duracion: 6,
    titulo: 'Flujo de trabajo recomendado',
    subtitulo: 'Cómo usar SafeCity en la práctica',
    narracion: 'El flujo recomendado es el siguiente: primero selecciona tu comuna, revisa el Dashboard para entender el contexto, explora el Mapa de Calor para ver los hotspots, genera una predicción con el modelo Ensemble y las nuevas zonas de riesgo aparecerán directamente en el mapa.',
    bg: 'from-slate-900 via-cyan-950 to-slate-900',
    visual: (
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2">
          {[
            { n: 1, texto: 'Selecciona tu comuna en el panel izquierdo', icon: '🏙️', color: 'border-blue-500/40 bg-blue-500/10' },
            { n: 2, texto: 'Dashboard → revisa KPIs y tendencias', icon: '📊', color: 'border-indigo-500/40 bg-indigo-500/10' },
            { n: 3, texto: 'Mapa → identifica hotspots reales', icon: '🗺️', color: 'border-orange-500/40 bg-orange-500/10' },
            { n: 4, texto: 'Predicciones → genera con modelo Ensemble', icon: '🤖', color: 'border-purple-500/40 bg-purple-500/10' },
            { n: 5, texto: 'Mapa → aparecen zonas de riesgo predichas', icon: '🎯', color: 'border-red-500/40 bg-red-500/10' },
          ].map(({ n, texto, icon, color }) => (
            <div key={n} className={`flex items-center gap-3 p-2.5 rounded-lg border ${color}`}>
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{n}</div>
              <span className="text-xs text-white/80">{icon} {texto}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

interface VideoOnboardingProps {
  onComplete: () => void;
}

export function VideoOnboarding({ onComplete }: VideoOnboardingProps) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const scene = SCENES[sceneIdx];
  const totalDuracion = SCENES.reduce((a, s) => a + s.duracion, 0);
  const tiempoAnterior = SCENES.slice(0, sceneIdx).reduce((a, s) => a + s.duracion, 0);
  const globalProgress = ((tiempoAnterior + (progress / 100) * scene.duracion) / totalDuracion) * 100;

  const palabras = scene.narracion.split(' ');

  const handleComplete = useCallback(() => {
    localStorage.setItem('safecity_onboarding_done', '1');
    onComplete();
    navigate('/dashboard');
  }, [onComplete, navigate]);

  // Avance de palabras de narración
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

  // Avance de progreso de escena
  useEffect(() => {
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!playing) return;
    const step = 100 / (scene.duracion * 20); // 20 fps
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p + step >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          // Avanzar a siguiente escena
          setTimeout(() => {
            if (sceneIdx < SCENES.length - 1) {
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
    if (sceneIdx < SCENES.length - 1) setSceneIdx(i => i + 1);
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
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{ aspectRatio: '16/10' }}>

        {/* Pantalla de contenido */}
        <div className={`relative bg-gradient-to-br ${scene.bg} h-[72%] flex flex-col items-center justify-center p-8 gap-6`}>
          {/* Botón cerrar */}
          <button onClick={handleComplete}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>

          {/* Número de escena */}
          <div className="absolute top-3 left-3 flex gap-1">
            {SCENES.map((_, i) => (
              <button key={i} onClick={() => setSceneIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === sceneIdx ? 'w-6 bg-white' : i < sceneIdx ? 'w-3 bg-white/50' : 'w-3 bg-white/20'}`} />
            ))}
          </div>

          {/* Visual de la escena */}
          <div className="flex-1 flex items-center justify-center w-full">
            {scene.visual}
          </div>

          {/* Título */}
          <div className="text-center">
            <h2 className="text-white font-bold text-xl">{scene.titulo}</h2>
            <p className="text-white/50 text-sm mt-0.5">{scene.subtitulo}</p>
          </div>
        </div>

        {/* Panel de narración + controles */}
        <div className="h-[28%] bg-slate-950 flex flex-col justify-between px-5 py-3">
          {/* Narración con palabras animadas */}
          <div className="flex-1 flex items-start gap-3 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Volume2 className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="text-sm text-white/90 leading-relaxed line-clamp-3">
              {palabras.map((palabra, i) => (
                <span key={i}
                  className={`transition-colors duration-200 ${i <= wordIdx ? 'text-white' : 'text-white/25'}`}>
                  {palabra}{' '}
                </span>
              ))}
            </p>
          </div>

          {/* Controles de video */}
          <div className="space-y-2">
            {/* Barra de progreso global */}
            <div className="cursor-pointer" onClick={handleSeek}>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden hover:h-1.5 transition-all">
                <div className="h-full bg-blue-500 rounded-full transition-none"
                  style={{ width: `${globalProgress}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setPlaying(p => !p)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button onClick={handleSkipScene}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <SkipForward className="h-4 w-4" />
                </button>
                <span className="text-white/40 text-xs ml-1">
                  {sceneIdx + 1} / {SCENES.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleComplete}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors">
                  Saltar
                </button>
                {sceneIdx === SCENES.length - 1 && (
                  <button onClick={handleComplete}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">
                    ¡Empezar!
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
