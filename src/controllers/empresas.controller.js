import prisma from "../config/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import QRCode from "qrcode";

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

function assertEmpresaAccess(req, id_empresa) {
  if (req.user?.rol === "comercio" && req.user.id !== id_empresa) {
    throw new AppError("No autorizado", 403);
  }
}

export async function getQrsEmpresa(req, res, next) {
  try {
    const id_empresa = Number(req.params.id);
    if (!Number.isInteger(id_empresa) || id_empresa <= 0) {
      throw new AppError("ID de empresa inválido", 400);
    }
    assertEmpresaAccess(req, id_empresa);
    const WEB_BASE = process.env.WEB_CIUDADANO_URL || "http://localhost:5173";
    const puntos = await prisma.puntoEcologico.findMany({
      where: { id_empresa },
      include: {
        regla: { include: { tipo: true } },
        _count: { select: { acciones: true } },
      },
      orderBy: { nombre: "asc" },
    });
    const result = await Promise.all(
      puntos.map(async (p) => {
        const url = `${WEB_BASE}/punto/${p.qr_codigo}`;
        const qr_data_url = await QRCode.toDataURL(url, {
          margin: 1,
          width: 280,
        });
        const qr_svg = await QRCode.toString(url, {
          type: "svg",
          margin: 1,
          width: 280,
        });
        return {
          id_punto: p.id_punto,
          nombre: p.nombre,
          qr_codigo: p.qr_codigo,
          campana: p.nombre_campana,
          estado: p.estado,
          tipo: p.regla?.tipo?.nombre ?? p.tipo_accion_permitida,
          puntos_por_unidad: p.regla?.puntos_por_unidad,
          escaneos: p._count.acciones,
          fecha_expiracion: p.fecha_expiracion,
          url,
          qr_data_url,
          qr_svg,
        };
      }),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function buildKpiPayload(id_empresa) {
  const empresa = await prisma.empresa.findUnique({
    where: { id_empresa },
    select: { id_empresa: true, nombre: true, tipo_empresa: true },
  });
  if (!empresa) throw new AppError("Empresa no encontrada", 404);

  const puntos = await prisma.puntoEcologico.findMany({
    where: { id_empresa },
    select: {
      id_punto: true,
      nombre: true,
      qr_codigo: true,
      tipo_accion_permitida: true,
      estado: true,
    },
  });

  const puntoIds = puntos.map((p) => p.id_punto);
  if (puntoIds.length === 0) {
    return {
      empresa,
      puntos: [],
      resumen: {
        acciones_total: 0,
        aprobadas: 0,
        pendientes: 0,
        rechazadas: 0,
        kg_reciclados: 0,
        co2_evitado: 0,
        ecocoins_otorgados: 0,
        ciudadanos_participantes: 0,
        campanas_activas: 0,
      },
      por_punto: [],
      actividad_reciente: [],
    };
  }

  const [porEstado, porPunto, recientes, ciudadanosUnicos, campanas] =
    await Promise.all([
      prisma.accion.groupBy({
        by: ["estado_validacion"],
        where: { id_punto: { in: puntoIds } },
        _count: { estado_validacion: true },
        _sum: { peso_kg: true, co2_evitado: true, ecocoins_ganados: true },
      }),
      prisma.accion.groupBy({
        by: ["id_punto", "estado_validacion"],
        where: { id_punto: { in: puntoIds } },
        _count: { id_punto: true },
      }),
      prisma.accion.findMany({
        where: { id_punto: { in: puntoIds }, estado_validacion: "aprobada" },
        orderBy: { fecha_validacion: "desc" },
        take: 8,
        select: {
          id_accion: true,
          ecocoins_ganados: true,
          fecha_validacion: true,
          respuesta_resumen: true,
          cantidad_declarada: true,
          punto: { select: { nombre: true } },
          usuario: { select: { nombre: true } },
        },
      }),
      prisma.accion.groupBy({
        by: ["id_usuario"],
        where: {
          id_punto: { in: puntoIds },
          estado_validacion: "aprobada",
          id_usuario: { not: null },
        },
      }),
      prisma.puntoEcologico.count({
        where: { id_empresa, estado: "activo", nombre_campana: { not: null } },
      }),
    ]);

  const resumen = {
    acciones_total: 0,
    aprobadas: 0,
    pendientes: 0,
    rechazadas: 0,
    kg_reciclados: 0,
    co2_evitado: 0,
    ecocoins_otorgados: 0,
    ciudadanos_participantes: ciudadanosUnicos.length,
    campanas_activas: campanas,
  };

  for (const row of porEstado) {
    const n = row._count.estado_validacion;
    resumen.acciones_total += n;
    if (row.estado_validacion === "aprobada") {
      resumen.aprobadas = n;
      resumen.kg_reciclados = Number(row._sum.peso_kg ?? 0);
      resumen.co2_evitado = Number(row._sum.co2_evitado ?? 0);
      resumen.ecocoins_otorgados = Number(row._sum.ecocoins_ganados ?? 0);
    } else if (row.estado_validacion === "pendiente") {
      resumen.pendientes = n;
    } else if (row.estado_validacion === "rechazada") {
      resumen.rechazadas = n;
    }
  }

  const porPuntoMap = puntos.map((p) => {
    const rows = porPunto.filter((r) => r.id_punto === p.id_punto);
    const stats = { aprobadas: 0, pendientes: 0, rechazadas: 0 };
    for (const r of rows) {
      stats[r.estado_validacion] = r._count.id_punto;
    }
    return {
      id_punto: p.id_punto,
      nombre: p.nombre,
      qr_codigo: p.qr_codigo,
      tipo: p.tipo_accion_permitida,
      ...stats,
      total: stats.aprobadas + stats.pendientes + stats.rechazadas,
    };
  });

  return {
    empresa,
    puntos,
    resumen,
    por_punto: porPuntoMap,
    actividad_reciente: recientes.map((a) => ({
      id_accion: a.id_accion,
      usuario: a.usuario?.nombre,
      punto: a.punto?.nombre,
      ecocoins: a.ecocoins_ganados,
      respuesta: a.respuesta_resumen,
      cantidad:
        a.cantidad_declarada != null ? Number(a.cantidad_declarada) : null,
      fecha: a.fecha_validacion,
    })),
  };
}

export async function getKpis(req, res, next) {
  try {
    const id_empresa = Number(req.params.id);
    if (!Number.isInteger(id_empresa) || id_empresa <= 0) {
      throw new AppError("ID de empresa inválido", 400);
    }
    assertEmpresaAccess(req, id_empresa);
    const payload = await buildKpiPayload(id_empresa);
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeEsgIndex(resumen, usuariosRecurrentes, campanasActivas) {
  const ambiental = clamp(
    Number(resumen.kg_reciclados) * 0.7 + Number(resumen.co2_evitado) * 0.12,
    0,
    100,
  );
  const social = clamp(
    Number(resumen.ciudadanos_participantes) * 1.8 + usuariosRecurrentes * 3.5,
    0,
    100,
  );
  const gobernanza = clamp(
    campanasActivas * 8 + Number(resumen.aprobadas) * 0.25,
    0,
    100,
  );
  return Math.round(ambiental * 0.5 + social * 0.35 + gobernanza * 0.15);
}

function formatRseLevel(score) {
  if (score >= 90) return "Elite RSE";
  if (score >= 75) return "Avanzado";
  if (score >= 55) return "Competente";
  return "En desarrollo";
}

export async function getAnalytics(req, res, next) {
  try {
    const id_empresa = Number(req.params.id);
    if (!Number.isInteger(id_empresa) || id_empresa <= 0) {
      throw new AppError("ID de empresa inválido", 400);
    }
    assertEmpresaAccess(req, id_empresa);

    const base = await buildKpiPayload(id_empresa);
    const puntoIds = base.puntos.map((p) => p.id_punto);

    if (puntoIds.length === 0) {
      return res.json({
        ...base,
        serie_mensual: [],
        por_material: [],
        top_qrs: [],
        estados_chart: [],
        top_ciudadanos: [],
        por_campana: [],
        qr_summary: { activos: 0, expirados: 0, total_escaneos: 0 },
        nuevos_ciudadanos: 0,
        usuarios_recurrentes: 0,
        promedio_diario: 0,
        promedio_mensual: 0,
        indice_esg: 0,
        nivel_rse: "En desarrollo",
        participacion_ecologica: 0,
        impacto_ambiental: { kg_reciclados: 0, co2_evitado: 0 },
        actualizado_en: new Date().toISOString(),
      });
    }

    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    const [acciones, nuevosUsuarios, usuariosByAccion, qrActivos, qrExpirados] =
      await Promise.all([
        prisma.accion.findMany({
          where: { id_punto: { in: puntoIds } },
          select: {
            estado_validacion: true,
            fecha_registro: true,
            peso_kg: true,
            co2_evitado: true,
            id_punto: true,
            punto: {
              select: {
                nombre: true,
                tipo_accion_permitida: true,
                nombre_campana: true,
              },
            },
          },
        }),
        prisma.usuario.count({
          where: {
            fecha_registro: { gte: last30Days },
            acciones: { some: { id_punto: { in: puntoIds } } },
          },
        }),
        prisma.accion.groupBy({
          by: ["id_usuario"],
          where: {
            id_punto: { in: puntoIds },
            estado_validacion: "aprobada",
            id_usuario: { not: null },
          },
          _count: { id_usuario: true },
          _sum: { ecocoins_ganados: true },
          orderBy: [{ _count: { id_usuario: "desc" } }],
          take: 10,
        }),
        prisma.puntoEcologico.count({
          where: {
            id_empresa,
            estado: "activo",
            OR: [{ fecha_expiracion: null }, { fecha_expiracion: { gt: now } }],
          },
        }),
        prisma.puntoEcologico.count({
          where: {
            id_empresa,
            fecha_expiracion: { lt: now },
          },
        }),
      ]);

    const serie_mensual = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mes = d.getMonth();
      const anio = d.getFullYear();
      const filtered = acciones.filter((a) => {
        const f = new Date(a.fecha_registro);
        return (
          f.getMonth() === mes &&
          f.getFullYear() === anio &&
          a.estado_validacion === "aprobada"
        );
      });
      const count = filtered.length;
      const kg = filtered.reduce(
        (sum, action) => sum + Number(action.peso_kg ?? 0),
        0,
      );
      serie_mensual.push({
        label: `${MESES[mes]} ${String(anio).slice(2)}`,
        value: count,
        kg: Math.round(kg * 10) / 10,
      });
    }

    const approvedActions = acciones.filter(
      (a) => a.estado_validacion === "aprobada",
    );
    const totalActions = acciones.length;
    const approvedIn30Days = acciones.filter((a) => {
      const f = new Date(a.fecha_registro);
      return f >= last30Days && a.estado_validacion === "aprobada";
    }).length;

    const materialMap = {};
    const campanaMap = {};
    const totalPorPunto = base.por_punto.reduce((acc, punto) => {
      acc[punto.id_punto] = punto.nombre_campana || punto.nombre;
      return acc;
    }, {});

    for (const action of approvedActions) {
      const key = action.punto?.tipo_accion_permitida || "Otros";
      materialMap[key] = (materialMap[key] || 0) + 1;
      const campaignKey =
        action.punto?.nombre_campana || action.punto?.nombre || "Sin campaña";
      campanaMap[campaignKey] = (campanaMap[campaignKey] || 0) + 1;
    }

    const por_material = Object.entries(materialMap).map(([label, value]) => ({
      label,
      value,
    }));
    const por_campana = Object.entries(campanaMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const approvedUserIds = usuariosByAccion
      .filter((group) => group.id_usuario)
      .map((group) => group.id_usuario);
    const usuarioRecords = await prisma.usuario.findMany({
      where: { id_usuario: { in: approvedUserIds } },
      select: { id_usuario: true, nombre: true },
    });
    const usuarioMap = Object.fromEntries(
      usuarioRecords.map((u) => [u.id_usuario, u.nombre]),
    );

    const top_ciudadanos = usuariosByAccion.slice(0, 5).map((group, index) => ({
      posicion: index + 1,
      nombre: usuarioMap[group.id_usuario] || "Ciudadano",
      acciones: group._count.id_usuario,
      ecocoins: Number(group._sum.ecocoins_ganados ?? 0),
    }));

    const usuarios_recurrentes = usuariosByAccion.filter(
      (group) => group._count.id_usuario >= 2,
    ).length;
    const promedio_diario = Math.round((approvedIn30Days / 30) * 10) / 10;
    const promedio_mensual = serie_mensual.length
      ? Math.round(
          (serie_mensual.reduce((sum, month) => sum + month.value, 0) /
            serie_mensual.length) *
            10,
        ) / 10
      : 0;
    const conversion_qr = totalActions
      ? Math.round((approvedActions.length / totalActions) * 100)
      : 0;
    const indice_esg = clamp(
      computeEsgIndex(
        base.resumen,
        usuarios_recurrentes,
        base.resumen.campanas_activas,
      ),
      0,
      100,
    );
    const nivel_rse = formatRseLevel(indice_esg);
    const participacion_ecologica = totalActions
      ? Math.round((approvedActions.length / totalActions) * 100)
      : 0;
    const top_qrs = [...base.por_punto]
      .sort((a, b) => b.aprobadas - a.aprobadas)
      .slice(0, 6)
      .map((p) => ({
        label: p.nombre?.slice(0, 18) || p.qr_codigo,
        value: p.aprobadas,
      }));
    const estados_chart = [
      { label: "Aprobadas", value: base.resumen.aprobadas },
      { label: "Pendientes", value: base.resumen.pendientes },
      { label: "Rechazadas", value: base.resumen.rechazadas },
    ].filter((x) => x.value > 0);

    const totalEscaneos = base.por_punto.reduce(
      (sum, punto) => sum + punto.total,
      0,
    );

    res.json({
      ...base,
      serie_mensual,
      por_material,
      por_campana,
      top_qrs,
      top_ciudadanos,
      estados_chart,
      qr_summary: {
        activos: qrActivos,
        expirados: qrExpirados,
        total_escaneos: totalEscaneos,
      },
      nuevos_ciudadanos: nuevosUsuarios,
      usuarios_recurrentes,
      promedio_diario,
      promedio_mensual,
      conversion_qr,
      indice_esg,
      nivel_rse,
      participacion_ecologica,
      impacto_ambiental: {
        kg_reciclados: base.resumen.kg_reciclados,
        co2_evitado: base.resumen.co2_evitado,
      },
      actualizado_en: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
