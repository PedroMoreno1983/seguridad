import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppStore } from '@/store';
import { useComuna, useComunas } from '@/hooks/useApi';
import type { User, UserRole } from '@/types';

import { Layout } from '@/components/Layout';
import { ActivosLayout } from '@/components/ActivosLayout';
import { VideoOnboarding } from '@/components/VideoOnboarding';
import { LoginPage } from '@/pages/Login';
import { SuitePage } from '@/pages/Suite';
import { DashboardPage } from '@/pages/Dashboard';
import { MapaPage } from '@/pages/Mapa';
import { PrediccionesPage } from '@/pages/Predicciones';
import { RankingPage } from '@/pages/Ranking';
import { ActivosDashboardPage } from '@/pages/ActivosDashboard';
import { FuentesPrivadasPage } from '@/pages/FuentesPrivadas';
import { PerfilamientoPage } from '@/pages/Perfilamiento';
import { ConfiguracionPage } from '@/pages/Configuracion';
import { EvaluacionesPage } from '@/pages/Evaluaciones';
import { ParticipacionPage } from '@/pages/Participacion';
import { Loader2 } from 'lucide-react';

function RequireRole({ roles, user, children }: { roles: UserRole[]; user: User | null; children: ReactNode }) {
  if (!user || !roles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  const { user, isAuthenticated, login, selectedComuna, setSelectedComuna } = useAppStore();

  // Cargar comunas disponibles
  const { data: comunas, isLoading: loadingComunas } = useComunas();

  // Cargar comuna del usuario o Peñalolén por defecto
  const { data: comunaData, isLoading: loadingComuna } = useComuna(
    user?.comuna_id || 22
  );

  useEffect(() => {
    if (comunaData && !selectedComuna) {
      setSelectedComuna(comunaData);
    }
  }, [comunaData, selectedComuna, setSelectedComuna]);

  // Onboarding: por usuario — cada cuenta nueva lo ve una vez
  const onboardingKey = `safecity_onboarding_${user?.id || 'anon'}`;
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(onboardingKey);
  });

  const handleOnboardingComplete = () => {
    localStorage.setItem(onboardingKey, '1');
    setShowOnboarding(false);
  };

  // Login handler
  const handleLogin = (token: string, userData: any) => {
    login(token, {
      id: userData.id,
      nombre: userData.nombre,
      email: userData.email,
      rol: userData.rol,
      tipo_usuario: userData.tipo_usuario ?? 'territorial',
      comuna_id: userData.comuna_id,
      organizacion_id: userData.organizacion_id,
    });
  };

  const tipoUsuario = user?.tipo_usuario ?? 'territorial';
  const productoActivo = tipoUsuario === 'organizacion' ? 'activos' : 'territorio';
  const rutaInicial = productoActivo === 'activos' ? '/activos' : '/territorio';

  // Timeout para loading inicial
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Si no está autenticado → Login
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if ((loadingComunas || loadingComuna) && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando SafeCity Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {showOnboarding && <VideoOnboarding onComplete={handleOnboardingComplete} />}
      <Routes>
        <Route path="/" element={<Navigate to={rutaInicial} replace />} />
        <Route path="/suite" element={<SuitePage />} />
        <Route path="/dashboard" element={<Navigate to="/territorio" replace />} />
        <Route path="/mapa" element={<Navigate to="/territorio/mapa" replace />} />
        <Route path="/predicciones" element={<Navigate to="/territorio/predicciones" replace />} />
        <Route path="/evaluaciones" element={<Navigate to="/territorio/evaluaciones" replace />} />
        <Route path="/participacion" element={<Navigate to="/territorio/participacion" replace />} />
        <Route path="/ranking" element={<Navigate to="/territorio/ranking" replace />} />
        <Route path="/configuracion" element={<Navigate to="/territorio/configuracion" replace />} />
        <Route path="/perfilamiento" element={<Navigate to="/activos/perfilamiento" replace />} />
        <Route path="/fuentes-privadas" element={<Navigate to="/activos/fuentes" replace />} />
        <Route path="/empresas" element={<Navigate to="/activos" replace />} />
        <Route path="/privado/*" element={<Navigate to="/activos" replace />} />
        <Route path="/privados" element={<Navigate to="/activos" replace />} />
        <Route
          path="/territorio/*"
          element={productoActivo === 'activos' ? <Navigate to="/activos" replace /> : (
            <Layout comunas={comunas || []}>
              <Routes>
                <Route index element={<DashboardPage />} />
                <Route path="mapa" element={<MapaPage />} />
                <Route path="predicciones" element={<PrediccionesPage />} />
                <Route path="evaluaciones" element={<EvaluacionesPage />} />
                <Route path="participacion" element={<ParticipacionPage />} />
                <Route path="ranking" element={<RankingPage />} />
                <Route path="configuracion" element={<ConfiguracionPage />} />
                <Route path="*" element={<DashboardPage />} />
              </Routes>
            </Layout>
          )}
        />
        <Route
          path="/activos/*"
          element={
            productoActivo === 'territorio' ? (
              <Navigate to="/territorio" replace />
            ) : (
              <RequireRole roles={['autoridad', 'tecnico', 'admin']} user={user}>
                <ActivosLayout>
                  <Routes>
                    <Route index element={<ActivosDashboardPage />} />
                    <Route path="perfilamiento" element={<PerfilamientoPage />} />
                    <Route path="fuentes" element={<FuentesPrivadasPage />} />
                    <Route path="carga" element={<FuentesPrivadasPage />} />
                    <Route path="configuracion" element={<ConfiguracionPage />} />
                    <Route path="*" element={<ActivosDashboardPage />} />
                  </Routes>
                </ActivosLayout>
              </RequireRole>
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
