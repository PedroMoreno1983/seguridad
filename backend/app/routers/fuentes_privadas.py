"""
Catalogo de fuentes para seguridad privada.

El objetivo es convertir conversaciones comerciales en una matriz concreta:
que datos pedir, a quien, por que sirven y como entran al modelo.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional


router = APIRouter()


class FuentePrivada(BaseModel):
    id: str
    nombre: str
    tipo: str
    verticales: List[str]
    origen: str
    datos_clave: List[str]
    integracion: List[str]
    dificultad: str
    valor_predictivo: int
    prioridad: int
    modulos: List[str]
    frecuencia_recomendada: str
    requisitos: List[str]
    riesgos: List[str]
    primer_paso: str


PRIVATE_SOURCES: List[FuentePrivada] = [
    FuentePrivada(
        id="pos_mermas",
        nombre="POS, ventas y mermas",
        tipo="transaccional",
        verticales=["retail", "supermercado", "farmacia", "tienda"],
        origen="ERP, POS, conciliacion de caja, inventario",
        datos_clave=["boleta", "sku", "monto", "hora", "caja", "sucursal", "anulaciones", "mermas"],
        integracion=["CSV", "Excel", "API", "SFTP"],
        dificultad="media",
        valor_predictivo=95,
        prioridad=1,
        modulos=["perdidas", "sucursales", "prediccion", "reportes"],
        frecuencia_recomendada="diaria",
        requisitos=["anonimizar cajero/cliente si no es indispensable", "homologar codigos de sucursal"],
        riesgos=["datos sensibles comerciales", "calidad variable por sistema POS"],
        primer_paso="Pedir 12 meses de ventas, mermas, anulaciones y diferencias de caja por sucursal.",
    ),
    FuentePrivada(
        id="incidentes_seguridad",
        nombre="Bitacora de incidentes internos",
        tipo="operacional",
        verticales=["retail", "mall", "logistica", "colegio", "clinica", "condominio", "industria"],
        origen="bitacora de guardias, tickets, planillas, app de novedades",
        datos_clave=["tipo", "descripcion", "fecha", "hora", "sede", "zona", "guardia", "evidencia"],
        integracion=["CSV", "Excel", "API", "formulario web"],
        dificultad="baja",
        valor_predictivo=100,
        prioridad=1,
        modulos=["incidentes", "mapa", "prediccion", "reportes"],
        frecuencia_recomendada="tiempo real o diaria",
        requisitos=["catalogo de tipos de incidente", "zonas internas por sede", "protocolo de carga"],
        riesgos=["subregistro", "texto libre dificil de normalizar"],
        primer_paso="Crear taxonomia de incidentes y cargar 6-12 meses de bitacoras historicas.",
    ),
    FuentePrivada(
        id="control_acceso",
        nombre="Control de acceso",
        tipo="sensor",
        verticales=["oficina", "industria", "colegio", "clinica", "condominio", "data_center"],
        origen="torniquetes, tarjetas, visitas, biometria, recepcion",
        datos_clave=["evento", "persona_anonima", "puerta", "zona", "fecha", "hora", "resultado"],
        integracion=["API", "CSV", "base de datos", "SFTP"],
        dificultad="media",
        valor_predictivo=85,
        prioridad=2,
        modulos=["accesos", "anomalias", "alertas", "reportes"],
        frecuencia_recomendada="horaria o diaria",
        requisitos=["hash de identificadores personales", "matriz de puertas y zonas"],
        riesgos=["datos personales", "integraciones propietarias"],
        primer_paso="Levantar listado de controladoras y exportar eventos de acceso rechazado/fuera de horario.",
    ),
    FuentePrivada(
        id="rondas_guardias",
        nombre="Rondas, check-ins y dotacion de guardias",
        tipo="operacional",
        verticales=["retail", "mall", "logistica", "condominio", "industria", "campus"],
        origen="GPS, QR, NFC, app de guardias, libro de asistencia",
        datos_clave=["guardia", "turno", "punto", "check_in", "lat", "lon", "novedad", "cumplimiento"],
        integracion=["API", "CSV", "app movil"],
        dificultad="media",
        valor_predictivo=90,
        prioridad=1,
        modulos=["patrullaje", "cumplimiento", "alertas", "reportes"],
        frecuencia_recomendada="tiempo real",
        requisitos=["puntos de control por sede", "turnos planificados", "politica de geolocalizacion"],
        riesgos=["privacidad laboral", "senales GPS imprecisas indoor"],
        primer_paso="Definir puntos QR/NFC criticos y comparar ronda planificada vs ronda ejecutada.",
    ),
    FuentePrivada(
        id="cctv_vms",
        nombre="CCTV / VMS / analitica de video",
        tipo="sensor",
        verticales=["mall", "retail", "logistica", "industria", "colegio", "clinica"],
        origen="VMS, NVR, analitica de video, camaras con eventos",
        datos_clave=["camara", "zona", "evento", "timestamp", "confianza", "estado", "snapshot_url"],
        integracion=["API", "webhook", "CSV"],
        dificultad="alta",
        valor_predictivo=80,
        prioridad=3,
        modulos=["cctv", "puntos_ciegos", "alertas", "evidencia"],
        frecuencia_recomendada="tiempo real o diaria",
        requisitos=["mapa camara-zona", "retencion de evidencia", "permisos de visualizacion"],
        riesgos=["video sensible", "falsos positivos", "licenciamiento VMS"],
        primer_paso="Partir solo con metadata de eventos y estado de camaras, no con video completo.",
    ),
    FuentePrivada(
        id="alarmas_sensores",
        nombre="Alarmas, sensores e intrusion",
        tipo="sensor",
        verticales=["retail", "bodega", "industria", "condominio", "oficina"],
        origen="central de alarmas, paneles, sensores, aperturas/cierres",
        datos_clave=["evento", "zona", "sensor", "fecha", "hora", "estado", "respuesta"],
        integracion=["API", "CSV", "webhook", "correo parseado"],
        dificultad="media",
        valor_predictivo=75,
        prioridad=2,
        modulos=["alertas", "respuesta", "falsas_alarmas", "reportes"],
        frecuencia_recomendada="tiempo real",
        requisitos=["catalogo de sensores", "zonas por sede", "clasificacion de falsas alarmas"],
        riesgos=["ruido operacional", "dependencia de proveedor de monitoreo"],
        primer_paso="Separar intrusion real, apertura fuera de horario, falla tecnica y falsa alarma.",
    ),
    FuentePrivada(
        id="mantencion_activos",
        nombre="Mantencion de activos criticos",
        tipo="infraestructura",
        verticales=["retail", "mall", "logistica", "industria", "condominio", "campus"],
        origen="CMMS, tickets, planillas de mantencion",
        datos_clave=["activo", "tipo", "ubicacion", "estado", "fecha_falla", "fecha_cierre", "prioridad"],
        integracion=["CSV", "Excel", "API"],
        dificultad="baja",
        valor_predictivo=70,
        prioridad=2,
        modulos=["rtm", "activos", "puntos_ciegos", "reportes"],
        frecuencia_recomendada="diaria o semanal",
        requisitos=["inventario de camaras, luminarias, cercos, puertas, alarmas", "ubicacion por zona"],
        riesgos=["datos incompletos", "cierres tardios de tickets"],
        primer_paso="Cruzar fallas de camaras/luminarias con incidentes por zona y horario.",
    ),
    FuentePrivada(
        id="logistica_rutas",
        nombre="Logistica, rutas y entregas",
        tipo="movilidad",
        verticales=["logistica", "retail", "ecommerce", "transporte", "industria"],
        origen="TMS, GPS flota, WMS, rutas planificadas",
        datos_clave=["ruta", "vehiculo", "parada", "hora", "gps", "incidente", "retraso", "carga"],
        integracion=["API", "CSV", "GPS feed"],
        dificultad="alta",
        valor_predictivo=85,
        prioridad=3,
        modulos=["rutas", "riesgo_entrega", "alertas", "reportes"],
        frecuencia_recomendada="tiempo real o diaria",
        requisitos=["anonimizar conductor", "rutas planificadas y ejecutadas", "catalogo de incidentes"],
        riesgos=["datos personales y comerciales", "volumen alto"],
        primer_paso="Identificar rutas/paradas con incidentes, retrasos repetidos o perdidas.",
    ),
    FuentePrivada(
        id="rrhh_turnos",
        nombre="Turnos, dotacion y ausentismo",
        tipo="operacional",
        verticales=["retail", "mall", "logistica", "clinica", "colegio", "industria"],
        origen="WFM, RRHH, libro de asistencia",
        datos_clave=["sede", "turno", "dotacion", "ausencias", "hora_inicio", "hora_fin", "rol"],
        integracion=["CSV", "Excel", "API"],
        dificultad="media",
        valor_predictivo=65,
        prioridad=3,
        modulos=["dotacion", "riesgo_turno", "reportes"],
        frecuencia_recomendada="diaria",
        requisitos=["agregar datos por rol/turno", "evitar identificacion personal innecesaria"],
        riesgos=["datos laborales sensibles", "calidad variable de asistencia"],
        primer_paso="Cruzar incidentes con dotacion real por turno y sede.",
    ),
    FuentePrivada(
        id="seguros_siniestros",
        nombre="Seguros y siniestros",
        tipo="financiero",
        verticales=["retail", "logistica", "industria", "condominio", "inmobiliaria"],
        origen="aseguradora, gestion de siniestros, finanzas",
        datos_clave=["tipo_siniestro", "monto", "fecha", "sede", "estado", "deducible", "causa"],
        integracion=["CSV", "Excel", "API"],
        dificultad="media",
        valor_predictivo=70,
        prioridad=3,
        modulos=["perdidas", "roi", "reportes_ejecutivos"],
        frecuencia_recomendada="mensual",
        requisitos=["normalizar montos", "separar perdida real de provision"],
        riesgos=["confidencialidad financiera", "rezago de cierre"],
        primer_paso="Crear ranking de sedes por costo de siniestros y recurrencia.",
    ),
    FuentePrivada(
        id="entorno_publico",
        nombre="Entorno publico y contexto territorial",
        tipo="externa",
        verticales=["retail", "mall", "logistica", "inmobiliaria", "colegio", "clinica"],
        origen="CEAD, datos comunales, clima, transporte, POI, eventos, datos abiertos",
        datos_clave=["delitos_comuna", "clima", "paraderos", "bancos", "colegios", "eventos", "flujo"],
        integracion=["API", "CSV", "scraping permitido", "carga manual"],
        dificultad="media",
        valor_predictivo=78,
        prioridad=2,
        modulos=["rtm", "prediccion", "entorno", "reportes"],
        frecuencia_recomendada="semanal o mensual",
        requisitos=["respetar licencias", "cache local", "validacion geoespacial"],
        riesgos=["series agregadas", "cambios de formato en portales externos"],
        primer_paso="Cargar delitos comunales, clima y puntos de interes cercanos a cada sede.",
    ),
]


VERTICAL_PLAYBOOKS = {
    "retail": [
        "Pedir ventas, mermas, anulaciones y diferencias de caja por sucursal.",
        "Cruzar incidentes internos con camaras, guardias, accesos y entorno comunal.",
        "Rankear sucursales por perdida esperada y horario critico.",
    ],
    "logistica": [
        "Pedir rutas planificadas, GPS ejecutado, incidentes, retrasos y valor de carga.",
        "Crear riesgo por parada, zona de detencion y franja horaria.",
        "Activar alertas por desvio, detencion prolongada o zona de alta recurrencia.",
    ],
    "mall": [
        "Pedir incidentes por zona comun, accesos, estacionamientos, CCTV y guardias.",
        "Cruzar flujo, eventos, clima y calendario comercial.",
        "Crear mapa de puntos ciegos y refuerzo por horario.",
    ],
    "colegio": [
        "Pedir eventos de convivencia, accesos, horarios, perimetro y rutas escolares.",
        "Separar seguridad, emergencia, convivencia y mantencion.",
        "Priorizar accesos, salida, estacionamientos y zonas sin visibilidad.",
    ],
    "condominio": [
        "Pedir accesos, visitas, encomiendas, rondas, alarmas y reclamos.",
        "Detectar horarios de mayor vulnerabilidad y fallas de cumplimiento.",
        "Reportar trazabilidad de guardias y eventos por torre/zona.",
    ],
}


@router.get("/fuentes-privadas/catalogo")
async def catalogo_fuentes_privadas(
    vertical: Optional[str] = Query(None, description="Filtrar por vertical, ej: retail"),
    dificultad: Optional[str] = Query(None, description="Filtrar por baja, media o alta"),
    prioridad_max: Optional[int] = Query(None, ge=1, le=5, description="Prioridad maxima a incluir"),
):
    fuentes = PRIVATE_SOURCES
    if vertical:
        vertical_norm = vertical.lower().strip()
        fuentes = [f for f in fuentes if vertical_norm in f.verticales]
    if dificultad:
        dificultad_norm = dificultad.lower().strip()
        fuentes = [f for f in fuentes if f.dificultad == dificultad_norm]
    if prioridad_max:
        fuentes = [f for f in fuentes if f.prioridad <= prioridad_max]

    fuentes = sorted(fuentes, key=lambda f: (f.prioridad, -f.valor_predictivo, f.dificultad))
    return {
        "total": len(fuentes),
        "vertical": vertical,
        "fuentes": fuentes,
    }


@router.get("/fuentes-privadas/resumen")
async def resumen_fuentes_privadas():
    prioridades = {}
    tipos = {}
    verticales = {}
    for fuente in PRIVATE_SOURCES:
        prioridades[fuente.prioridad] = prioridades.get(fuente.prioridad, 0) + 1
        tipos[fuente.tipo] = tipos.get(fuente.tipo, 0) + 1
        for vertical in fuente.verticales:
            verticales[vertical] = verticales.get(vertical, 0) + 1

    top = sorted(PRIVATE_SOURCES, key=lambda f: (f.prioridad, -f.valor_predictivo))[:5]
    return {
        "total_fuentes": len(PRIVATE_SOURCES),
        "por_prioridad": prioridades,
        "por_tipo": tipos,
        "verticales": dict(sorted(verticales.items())),
        "primeras_5_fuentes": top,
    }


@router.get("/fuentes-privadas/playbook/{vertical}")
async def playbook_vertical(vertical: str):
    vertical_norm = vertical.lower().strip()
    fuentes = [f for f in PRIVATE_SOURCES if vertical_norm in f.verticales]
    fuentes = sorted(fuentes, key=lambda f: (f.prioridad, -f.valor_predictivo))
    return {
        "vertical": vertical_norm,
        "pasos": VERTICAL_PLAYBOOKS.get(vertical_norm, [
            "Levantar incidentes internos y sedes.",
            "Conectar fuentes operacionales con mayor valor predictivo.",
            "Cruzar datos privados con entorno publico validado.",
        ]),
        "fuentes_prioritarias": fuentes[:6],
    }
