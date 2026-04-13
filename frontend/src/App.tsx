import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import { ConfiguracionPage } from '@/pages/Configuracion';
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

  // Onboarding: mostrar solo si es la primera vez
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('safecity_onboarding_done');
  });

  const handleOnboardingComplete = () => {
    localStorage.setItem('safecity_onboarding_done', '1');
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
      <Layout comunas={comunas || []}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/mapa" element={<MapaPage />} />
          <Route path="/predicciones" element={<PrediccionesPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
