// Datos demo para Atalaya Activos — seguridad privada
// Organización retail con 3 sedes en Santiago

export const STATIC_ORGANIZACIONES = [
  {
    id: 1,
    nombre: 'Retail Seguro S.A.',
    vertical: 'retail',
    estado: 'activo',
    rut: '76.543.210-9',
    contacto_nombre: 'Carlos Pérez',
    contacto_email: 'seguridad@retailseguro.cl',
  },
];

export const STATIC_SEDES = [
  {
    id: 1, organizacion_id: 1,
    nombre: 'Tienda La Granja',
    tipo: 'tienda',
    direccion: 'Av. Santa Rosa 9400',
    comuna: 'La Granja',
    region: 'Región Metropolitana',
    latitud: -33.5356, longitud: -70.6325,
    activa: true,
    zonas: ['Sala ventas', 'Bodega', 'Cajas', 'Acceso'],
    activos_criticos: ['Caja principal', 'DVR cámaras', 'Caja fuerte'],
  },
  {
    id: 2, organizacion_id: 1,
    nombre: 'Tienda Peñalolén',
    tipo: 'tienda',
    direccion: 'Av. Grecia 6301',
    comuna: 'Peñalolén',
    region: 'Región Metropolitana',
    latitud: -33.4828, longitud: -70.5089,
    activa: true,
    zonas: ['Sala ventas', 'Bodega', 'Cajas', 'Estacionamiento'],
    activos_criticos: ['Caja principal', 'DVR cámaras'],
  },
  {
    id: 3, organizacion_id: 1,
    nombre: 'Bodega Pudahuel',
    tipo: 'bodega',
    direccion: 'Av. Américo Vespucio 1600',
    comuna: 'Pudahuel',
    region: 'Región Metropolitana',
    latitud: -33.44, longitud: -70.82,
    activa: true,
    zonas: ['Nave A', 'Nave B', 'Oficinas', 'Acceso camiones'],
    activos_criticos: ['Generador', 'Servidores', 'Cámara frigorífica'],
  },
];

function fecha(diasAtras: number, hora = '12:00') {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().split('T')[0] + `T${hora}:00-04:00`;
}

export const STATIC_INCIDENTES = [
  { id: 1,  organizacion_id: 1, sede_id: 1, tipo: 'Hurto', categoria: 'merma', severidad: 2, fecha_hora: fecha(3, '14:22'),  zona: 'Sala ventas',   fuente: 'camara',   monto_estimado: 45000 },
  { id: 2,  organizacion_id: 1, sede_id: 2, tipo: 'Hurto', categoria: 'merma', severidad: 2, fecha_hora: fecha(5, '17:45'),  zona: 'Sala ventas',   fuente: 'camara',   monto_estimado: 28000 },
  { id: 3,  organizacion_id: 1, sede_id: 1, tipo: 'Robo con fuerza', categoria: 'robo', severidad: 4, fecha_hora: fecha(8, '02:10'),  zona: 'Acceso',   fuente: 'alarma',   monto_estimado: 380000 },
  { id: 4,  organizacion_id: 1, sede_id: 3, tipo: 'Daños a propiedad', categoria: 'vandalismo', severidad: 2, fecha_hora: fecha(10, '23:30'), zona: 'Acceso camiones', fuente: 'guardia', monto_estimado: 95000 },
  { id: 5,  organizacion_id: 1, sede_id: 2, tipo: 'Hurto', categoria: 'merma', severidad: 2, fecha_hora: fecha(12, '16:00'), zona: 'Cajas',         fuente: 'camara',   monto_estimado: 62000 },
  { id: 6,  organizacion_id: 1, sede_id: 1, tipo: 'Fraude', categoria: 'fraude', severidad: 3, fecha_hora: fecha(15, '11:20'), zona: 'Cajas',        fuente: 'sistema',  monto_estimado: 210000 },
  { id: 7,  organizacion_id: 1, sede_id: 3, tipo: 'Hurto', categoria: 'merma', severidad: 1, fecha_hora: fecha(18, '09:40'), zona: 'Nave A',         fuente: 'guardia',  monto_estimado: 15000 },
  { id: 8,  organizacion_id: 1, sede_id: 2, tipo: 'Robo con violencia', categoria: 'robo', severidad: 5, fecha_hora: fecha(22, '19:55'), zona: 'Estacionamiento', fuente: 'guardia', monto_estimado: 480000 },
  { id: 9,  organizacion_id: 1, sede_id: 1, tipo: 'Hurto', categoria: 'merma', severidad: 2, fecha_hora: fecha(25, '15:10'), zona: 'Sala ventas',    fuente: 'camara',   monto_estimado: 38000 },
  { id: 10, organizacion_id: 1, sede_id: 1, tipo: 'Incidente seguridad', categoria: 'alarma', severidad: 1, fecha_hora: fecha(28, '03:20'), zona: 'Bodega', fuente: 'alarma', monto_estimado: 0 },
  { id: 11, organizacion_id: 1, sede_id: 2, tipo: 'Hurto', categoria: 'merma', severidad: 2, fecha_hora: fecha(33, '13:50'), zona: 'Sala ventas',    fuente: 'camara',   monto_estimado: 55000 },
  { id: 12, organizacion_id: 1, sede_id: 3, tipo: 'Daños a propiedad', categoria: 'vandalismo', severidad: 3, fecha_hora: fecha(40, '01:15'), zona: 'Nave B', fuente: 'alarma', monto_estimado: 175000 },
  { id: 13, organizacion_id: 1, sede_id: 1, tipo: 'Hurto', categoria: 'merma', severidad: 2, fecha_hora: fecha(45, '16:30'), zona: 'Sala ventas',    fuente: 'camara',   monto_estimado: 72000 },
  { id: 14, organizacion_id: 1, sede_id: 2, tipo: 'Fraude', categoria: 'fraude', severidad: 3, fecha_hora: fecha(52, '10:00'), zona: 'Cajas',         fuente: 'sistema',  monto_estimado: 130000 },
  { id: 15, organizacion_id: 1, sede_id: 1, tipo: 'Robo con fuerza', categoria: 'robo', severidad: 4, fecha_hora: fecha(60, '04:45'), zona: 'Acceso',   fuente: 'alarma',   monto_estimado: 520000 },
  { id: 16, organizacion_id: 1, sede_id: 3, tipo: 'Hurto', categoria: 'merma', severidad: 1, fecha_hora: fecha(70, '14:00'), zona: 'Oficinas',        fuente: 'guardia',  monto_estimado: 22000 },
  { id: 17, organizacion_id: 1, sede_id: 2, tipo: 'Hurto', categoria: 'merma', severidad: 2, fecha_hora: fecha(80, '17:20'), zona: 'Sala ventas',    fuente: 'camara',   monto_estimado: 41000 },
  { id: 18, organizacion_id: 1, sede_id: 1, tipo: 'Incidente seguridad', categoria: 'alarma', severidad: 1, fecha_hora: fecha(95, '02:00'), zona: 'Acceso', fuente: 'alarma', monto_estimado: 0 },
  { id: 19, organizacion_id: 1, sede_id: 2, tipo: 'Daños a propiedad', categoria: 'vandalismo', severidad: 2, fecha_hora: fecha(110, '22:10'), zona: 'Estacionamiento', fuente: 'camara', monto_estimado: 88000 },
  { id: 20, organizacion_id: 1, sede_id: 1, tipo: 'Hurto', categoria: 'merma', severidad: 2, fecha_hora: fecha(120, '15:40'), zona: 'Sala ventas',   fuente: 'camara',   monto_estimado: 33000 },
];

const total = STATIC_INCIDENTES.reduce((s, i) => s + (i.monto_estimado || 0), 0);

export const STATIC_RESUMEN_OPERATIVO = {
  resumen: {
    sedes: STATIC_SEDES.length,
    incidentes: STATIC_INCIDENTES.length,
    perdidas_estimadas: total,
    ultimo_incidente: STATIC_INCIDENTES[0].fecha_hora,
  },
  por_tipo: [
    { tipo: 'Hurto',               cantidad: 9,  perdidas: 409000 },
    { tipo: 'Robo con fuerza',     cantidad: 2,  perdidas: 900000 },
    { tipo: 'Robo con violencia',  cantidad: 1,  perdidas: 480000 },
    { tipo: 'Daños a propiedad',   cantidad: 3,  perdidas: 358000 },
    { tipo: 'Fraude',              cantidad: 2,  perdidas: 340000 },
    { tipo: 'Incidente seguridad', cantidad: 2,  perdidas: 0 },
  ],
  por_sede: STATIC_SEDES.map((s) => ({
    sede_id: s.id,
    sede_nombre: s.nombre,
    incidentes: STATIC_INCIDENTES.filter((i) => i.sede_id === s.id).length,
    perdidas: STATIC_INCIDENTES.filter((i) => i.sede_id === s.id).reduce((acc, i) => acc + (i.monto_estimado || 0), 0),
  })),
};
