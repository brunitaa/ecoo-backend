import prisma from "../config/prisma.js";

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export async function getDashboardStats(_req, res, next) {
  try {
    const now = new Date();
    const [
      empresasActivas,
      pendientes,
      porEstado,
      ecocoinsSum,
      usuariosActivos,
      puntosQr,
      campanas,
      recientes,
      accionAprobadaTimes,
      qrsActivos,
      qrsExpirados,
    ] = await Promise.all([
      prisma.empresa.count({ where: { estado_suscripcion: "activa" } }),
      prisma.accion.count({ where: { estado_validacion: "pendiente" } }),
      prisma.accion.groupBy({
        by: ["estado_validacion"],
        _count: { estado_validacion: true },
        _sum: { peso_kg: true, co2_evitado: true, ecocoins_ganados: true },
      }),
      prisma.accion.aggregate({
        where: { estado_validacion: "aprobada" },
        _sum: { ecocoins_ganados: true, peso_kg: true, co2_evitado: true },
      }),
      prisma.accion.groupBy({
        by: ["id_usuario"],
        where: { estado_validacion: "aprobada", id_usuario: { not: null } },
      }),
      prisma.puntoEcologico.count({ where: { estado: "activo" } }),
      prisma.puntoEcologico.count({
        where: { estado: "activo", nombre_campana: { not: null } },
      }),
      prisma.accion.findMany({
        orderBy: { fecha_registro: "desc" },
        take: 10,
        include: {
          usuario: { select: { nombre: true } },
          punto: {
            select: { nombre: true, empresa: { select: { nombre: true } } },
          },
        },
      }),
      prisma.accion.findMany({
        where: {
          estado_validacion: "aprobada",
          fecha_validacion: { not: null },
        },
        select: { fecha_registro: true, fecha_validacion: true },
      }),
      prisma.puntoEcologico.count({
        where: { fecha_expiracion: { lt: now } },
      }),
    ]);

    const estados = { pendiente: 0, aprobada: 0, rechazada: 0 };
    for (const row of porEstado) {
      estados[row.estado_validacion] = row._count.estado_validacion;
    }

    const totalAcciones =
      estados.pendiente + estados.aprobada + estados.rechazada;
    const tasaAprobacion = totalAcciones
      ? Math.round((estados.aprobada / totalAcciones) * 100)
      : 0;

    const promedioAprobacionHoras = accionAprobadaTimes.length
      ? Math.round(
          accionAprobadaTimes.reduce((sum, item) => {
            const inicio = new Date(item.fecha_registro).getTime();
            const fin = new Date(item.fecha_validacion).getTime();
            return sum + Math.max(0, fin - inicio);
          }, 0) /
            accionAprobadaTimes.length /
            3600000,
        )
      : 0;

    const ranking = await prisma.accion.groupBy({
      by: ["id_usuario"],
      where: { estado_validacion: "aprobada", id_usuario: { not: null } },
      _sum: { ecocoins_ganados: true },
      orderBy: { _sum: { ecocoins_ganados: "desc" } },
      take: 5,
    });

    const userIds = ranking.map((r) => r.id_usuario).filter(Boolean);
    const users = await prisma.usuario.findMany({
      where: { id_usuario: { in: userIds } },
      select: { id_usuario: true, nombre: true },
    });
    const userMap = Object.fromEntries(
      users.map((u) => [u.id_usuario, u.nombre]),
    );

    const accionesRecientes = await prisma.accion.findMany({
      where: { estado_validacion: "aprobada" },
      select: { fecha_registro: true },
      orderBy: { fecha_registro: "desc" },
      take: 500,
    });

    const serie_mensual = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mes = d.getMonth();
      const anio = d.getFullYear();
      const value = accionesRecientes.filter((a) => {
        const f = new Date(a.fecha_registro);
        return f.getMonth() === mes && f.getFullYear() === anio;
      }).length;
      serie_mensual.push({
        label: `${MESES[mes]} ${String(anio).slice(2)}`,
        value,
      });
    }

    const porEmpresa = await prisma.accion.groupBy({
      by: ["id_punto"],
      where: { estado_validacion: "aprobada", id_punto: { not: null } },
      _count: { id_punto: true },
    });

    const puntoIds = porEmpresa.map((p) => p.id_punto).filter(Boolean);
    const puntos = await prisma.puntoEcologico.findMany({
      where: { id_punto: { in: puntoIds } },
      select: { id_punto: true, empresa: { select: { nombre: true } } },
    });
    const empresaCount = {};
    for (const row of porEmpresa) {
      const punto = puntos.find((p) => p.id_punto === row.id_punto);
      const nombre = punto?.empresa?.nombre || "Sin empresa";
      empresaCount[nombre] = (empresaCount[nombre] || 0) + row._count.id_punto;
    }
    const actividad_empresas = Object.entries(empresaCount)
      .map(([label, value]) => ({ label: label.slice(0, 20), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const top_empresas = actividad_empresas.slice(0, 5);

    const estados_chart = [
      { label: "Aprobadas", value: estados.aprobada },
      { label: "Pendientes", value: estados.pendiente },
      { label: "Rechazadas", value: estados.rechazada },
    ].filter((x) => x.value > 0);

    const alertas = [];
    if (pendientes > 40) {
      alertas.push({
        tipo: "Alerta",
        mensaje: `Hay ${pendientes} solicitudes pendientes que requieren moderación urgente.`,
      });
    }
    if (qrsExpirados > 0) {
      alertas.push({
        tipo: "Atención",
        mensaje: `${qrsExpirados} QRs han expirado y deben revisarse para campañas.`,
      });
    }
    if (estados.aprobada < estados.rechazada) {
      alertas.push({
        tipo: "Insight",
        mensaje:
          "La tasa de rechazo es superior a las aprobaciones. Revisa el proceso de verificación.",
      });
    }

    res.json({
      resumen: {
        empresas_activas: empresasActivas,
        solicitudes_pendientes: pendientes,
        solicitudes_aprobadas: estados.aprobada,
        solicitudes_rechazadas: estados.rechazada,
        reciclajes_total: totalAcciones,
        aprobados: estados.aprobada,
        rechazados: estados.rechazada,
        ciudadanos_participantes: usuariosActivos.length,
        qrs_activos: puntosQr,
        qrs_expirados: qrsExpirados,
        campanas_activas: campanas,
        ecoo_points_entregados: Number(ecocoinsSum._sum.ecocoins_ganados ?? 0),
        kg_recuperados: Number(ecocoinsSum._sum.peso_kg ?? 0),
        co2_evitado: Number(ecocoinsSum._sum.co2_evitado ?? 0),
        tasa_aprobacion: tasaAprobacion,
        promedio_aprobacion_horas: promedioAprobacionHoras,
      },
      actividad_reciente: recientes.map((a) => ({
        id_accion: a.id_accion,
        estado: a.estado_validacion,
        usuario: a.usuario?.nombre,
        punto: a.punto?.nombre,
        empresa: a.punto?.empresa?.nombre,
        ecocoins_estimados: a.ecocoins_estimados,
        fecha: a.fecha_registro,
      })),
      ranking: ranking.map((r, i) => ({
        posicion: i + 1,
        nombre: userMap[r.id_usuario] || "Ciudadano",
        ecocoins: Number(r._sum.ecocoins_ganados ?? 0),
      })),
      serie_mensual,
      actividad_empresas,
      top_empresas,
      estados_chart,
      alertas,
      actualizado_en: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
