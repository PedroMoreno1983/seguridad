-- ==========================================
-- SEED: COMUNAS DE LA REGIÓN METROPOLITANA
-- Datos iniciales para desarrollo y demo
-- ==========================================

INSERT INTO comunas (codigo_ine, nombre, nombre_normalizado, region, codigo_region, provincia, poblacion, superficie_km2) VALUES
('13101', 'Santiago', 'santiago', 'Región Metropolitana de Santiago', '13', 'Santiago', 404495, 22.4),
('13102', 'Cerrillos', 'cerrillos', 'Región Metropolitana de Santiago', '13', 'Santiago', 80457, 21.0),
('13103', 'Cerro Navia', 'cerro navia', 'Región Metropolitana de Santiago', '13', 'Santiago', 132622, 11.0),
('13104', 'Conchalí', 'conchali', 'Región Metropolitana de Santiago', '13', 'Santiago', 133256, 11.0),
('13105', 'El Bosque', 'el bosque', 'Región Metropolitana de Santiago', '13', 'Santiago', 162505, 14.1),
('13106', 'Estación Central', 'estacion central', 'Región Metropolitana de Santiago', '13', 'Santiago', 147041, 14.2),
('13107', 'Huechuraba', 'huechuraba', 'Región Metropolitana de Santiago', '13', 'Santiago', 98671, 44.8),
('13108', 'Independencia', 'independencia', 'Región Metropolitana de Santiago', '13', 'Santiago', 100239, 7.0),
('13109', 'La Cisterna', 'la cisterna', 'Región Metropolitana de Santiago', '13', 'Santiago', 90219, 10.0),
('13110', 'La Florida', 'la florida', 'Región Metropolitana de Santiago', '13', 'Santiago', 366916, 71.0),
('13111', 'La Granja', 'la granja', 'Región Metropolitana de Santiago', '13', 'Santiago', 121673, 10.0),
('13112', 'La Pintana', 'la pintana', 'Región Metropolitana de Santiago', '13', 'Santiago', 190085, 30.0),
('13113', 'La Reina', 'la reina', 'Región Metropolitana de Santiago', '13', 'Santiago', 96762, 23.0),
('13114', 'Las Condes', 'las condes', 'Región Metropolitana de Santiago', '13', 'Santiago', 294838, 99.0),
('13115', 'Lo Barnechea', 'lo barnechea', 'Región Metropolitana de Santiago', '13', 'Santiago', 105833, 1024.0),
('13116', 'Lo Espejo', 'lo espejo', 'Región Metropolitana de Santiago', '13', 'Santiago', 98561, 7.0),
('13117', 'Lo Prado', 'lo prado', 'Región Metropolitana de Santiago', '13', 'Santiago', 104403, 7.0),
('13118', 'Macul', 'macul', 'Región Metropolitana de Santiago', '13', 'Santiago', 116371, 12.0),
('13119', 'Maipú', 'maipu', 'Región Metropolitana de Santiago', '13', 'Santiago', 522795, 135.0),
('13120', 'Ñuñoa', 'nunoa', 'Región Metropolitana de Santiago', '13', 'Santiago', 208845, 16.0),
('13121', 'Pedro Aguirre Cerda', 'pedro aguirre cerda', 'Región Metropolitana de Santiago', '13', 'Santiago', 101058, 10.0),
('13122', 'Peñalolén', 'penalolen', 'Región Metropolitana de Santiago', '13', 'Santiago', 241133, 54.0),
('13123', 'Providencia', 'providencia', 'Región Metropolitana de Santiago', '13', 'Santiago', 120874, 14.0),
('13124', 'Pudahuel', 'pudahuel', 'Región Metropolitana de Santiago', '13', 'Santiago', 230293, 197.0),
('13125', 'Quilicura', 'quilicura', 'Región Metropolitana de Santiago', '13', 'Santiago', 210410, 58.0),
('13126', 'Quinta Normal', 'quinta normal', 'Región Metropolitana de Santiago', '13', 'Santiago', 104058, 13.0),
('13127', 'Recoleta', 'recoleta', 'Región Metropolitana de Santiago', '13', 'Santiago', 148220, 16.0),
('13128', 'Renca', 'renca', 'Región Metropolitana de Santiago', '13', 'Santiago', 147151, 24.0),
('13129', 'San Joaquín', 'san joaquin', 'Región Metropolitana de Santiago', '13', 'Santiago', 97779, 10.0),
('13130', 'San Miguel', 'san miguel', 'Región Metropolitana de Santiago', '13', 'Santiago', 107453, 10.0),
('13131', 'San Ramón', 'san ramon', 'Región Metropolitana de Santiago', '13', 'Santiago', 82100, 6.0),
('13132', 'Vitacura', 'vitacura', 'Región Metropolitana de Santiago', '13', 'Santiago', 85284, 28.0)
ON CONFLICT (codigo_ine) DO NOTHING;
