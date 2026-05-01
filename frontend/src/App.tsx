import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { useComuna, useComunas } from '@/hooks/useApi';

import { Layout } from '@/components/Layout';
import { VideoOnboarding } from '@/components/VideoOnboarding';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { MapaPage } from '@/pages/Mapa';
import { PrediccionesPage } from '@/pages/Predicciones';
import { RankingPage } from '@/pages/Ranking';
import { FuentesPrivadasPage } from '@/pages/FuentesPrivadas';
import { EmpresasPage } from '@/pages/Empresas';
import { ConfiguracionPage } from '@/pages/Configuracion';
import { EvaluacionesPage } from '@/pages/Evaluaciones';
import { ParticipacionPage } from '@/pages/Participacion';
import { Loader2 } from 'lucide-react';

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
      comuna_id: userData.comuna_id,
    });
  };

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
        <Route path="/privado/*" element={<Navigate to="/empresas" replace />} />
        <Route path="/privados" element={<Navigate to="/empresas" replace />} />
        <Route
          path="/*"
          element={(
            <Layout comunas={comunas || []}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/mapa" element={<MapaPage />} />
                <Route path="/predicciones" element={<PrediccionesPage />} />
                <Route path="/evaluaciones" element={<EvaluacionesPage />} />
                <Route path="/participacion" element={<ParticipacionPage />} />
                <Route path="/ranking" element={<RankingPage />} />
                <Route path="/empresas" element={<EmpresasPage />} />
                <Route path="/fuentes-privadas" element={<FuentesPrivadasPage />} />
                <Route path="/configuracion" element={<ConfiguracionPage />} />
                <Route path="*" element={<DashboardPage />} />
              </Routes>
            </Layout>
          )}
        />
      </Routes>
    </Router>
  );
}

export default App;
