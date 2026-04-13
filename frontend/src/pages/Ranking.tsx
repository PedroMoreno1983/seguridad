import { useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Search } from 'lucide-react';
import { useRanking, useRegiones } from '@/hooks/useApi';

export function RankingPage() {
  const [regionFilter, setRegionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [ordenarPor, setOrdenarPor] = useState('global');
  
  const { data: ranking, isLoading } = useRanking(regionFilter || undefined);
  const { data: regiones } = useRegiones();
  
  const datosFiltrados = ranking?.ranking?.filter((item: any) => {
    const matchesSearch = item.comuna.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          Ranking de Seguridad
        </h1>
        <p className="text-muted-foreground mt-2">Comparativa de índices de seguridad entre comunas de Chile.</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar comuna..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg"
            />
          </div>
        </div>
        
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="px-4 py-2 bg-card border border-border rounded-lg"
        >
          <option value="">Todas las regiones</option>
          {regiones?.map((r: any) => (
            <option key={r.codigo} value={r.nombre}>{r.nombre}</option>
          ))}
        </select>
        
        <select
          value={ordenarPor}
          onChange={(e) => setOrdenarPor(e.target.value)}
          className="px-4 py-2 bg-card border border-border rounded-lg"
        >
          <option value="global">Índice Global</option>
          <option value="delictual">Tasa Delictual</option>
          <option value="percepcion">Percepción</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando ranking...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Posición</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Comuna</th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-sm font-medium text-muted-foreground">Región</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Índice Global</th>
                  <th className="hidden md:table-cell px-4 py-3 text-center text-sm font-medium text-muted-foreground">Tasa Delictual</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Tendencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {datosFiltrados.map((item: any, idx: number) => {
                  const TendenciaIcon = item.tendencia === 'bajando' ? TrendingDown :
                                       item.tendencia === 'subiendo' ? TrendingUp : Minus;
                  
                  const tendenciaColor = item.tendencia === 'bajando' ? 'text-green-500' :
                                        item.tendencia === 'subiendo' ? 'text-red-500' : 'text-gray-500';
                  
                  return (
                    <tr key={item.comuna.id} className="hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : idx === 1 ? 'bg-gray-400/20 text-gray-400' : idx === 2 ? 'bg-orange-600/20 text-orange-600' : 'bg-muted text-muted-foreground'}`}>
                          {item.posicion_ranking}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium">{item.comuna.nombre}</td>
                      <td className="hidden md:table-cell px-4 py-4 text-muted-foreground">{item.comuna.region}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${(item.indices.global || 0) >= 70 ? 'bg-green-500/10 text-green-500' : (item.indices.global || 0) >= 50 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                          {item.indices.global?.toFixed(1) || 'N/A'}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-4 text-center text-muted-foreground">{item.tasas.delictual?.toFixed(1) || 'N/A'}</td>
                      <td className="px-4 py-4 text-center">
                        <div className={`flex items-center justify-center gap-1 ${tendenciaColor}`}>
                          <TendenciaIcon className="h-4 w-4" />
                          <span className="text-sm capitalize">{item.tendencia}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {!isLoading && datosFiltrados.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No se encontraron comunas con los filtros aplicados.</div>
        )}
      </div>
    </div>
  );
}
