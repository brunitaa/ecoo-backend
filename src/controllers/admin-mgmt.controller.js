import prisma from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizarRegla } from '../utils/ecocoins.js';
import QRCode from 'qrcode';

const WEB_BASE = process.env.WEB_CIUDADANO_URL || 'http://localhost:5173';

function slugify(s) {
  return String(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .slice(0, 20);
}

export async function listarEmpresas(_req, res, next) {
  try {
    const empresas = await prisma.empresa.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        plan: { select: { nombre: true } },
        _count: { select: { puntos: true, reglas: true } },
      },
    });
    res.json(
      empresas.map((e) => ({
        id_empresa: e.id_empresa,
        nombre: e.nombre,
        tipo_empresa: e.tipo_empresa,
        correo_contacto: e.correo_contacto,
        estado: e.estado,
        estado_suscripcion: e.estado_suscripcion,
        plan: e.plan?.nombre,
        puntos_count: e._count.puntos,
        reglas_count: e._count.reglas,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function actualizarEmpresa(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { estado_suscripcion, estado } = req.body;
    const empresa = await prisma.empresa.update({
      where: { id_empresa: id },
      data: {
        ...(estado_suscripcion != null ? { estado_suscripcion } : {}),
        ...(estado != null ? { estado } : {}),
      },
    });
    res.json(empresa);
  } catch (err) {
    next(err);
  }
}

export async function listarTipos(_req, res, next) {
  try {
    const tipos = await prisma.tipoReciclaje.findMany({ orderBy: { nombre: 'asc' } });
    res.json(tipos);
  } catch (err) {
    next(err);
  }
}

export async function listarReglas(_req, res, next) {
  try {
    const reglas = await prisma.reglaPunto.findMany({
      orderBy: { id_regla: 'desc' },
      include: {
        empresa: { select: { nombre: true } },
        tipo: true,
        _count: { select: { puntos: true } },
      },
    });
    res.json(
      reglas.map((r) => ({
        id_regla: r.id_regla,
        empresa_id: r.id_empresa,
        empresa_nombre: r.empresa.nombre,
        tipo: r.tipo,
        puntos_por_unidad: r.puntos_por_unidad,
        estado: r.estado,
        vigencia_inicio: r.vigencia_inicio,
        vigencia_fin: r.vigencia_fin,
        observaciones: r.observaciones,
        qrs_asociados: r._count.puntos,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function crearRegla(req, res, next) {
  try {
    const {
      id_empresa,
      id_tipo,
      puntos_por_unidad,
      co2_por_unidad,
      peso_kg_por_unidad,
      observaciones,
      vigencia_inicio,
      vigencia_fin,
    } = req.body;
    if (!id_empresa || !id_tipo || puntos_por_unidad == null) {
      throw new AppError('id_empresa, id_tipo y puntos_por_unidad son requeridos', 400);
    }
    const regla = await prisma.reglaPunto.create({
      data: {
        id_empresa: Number(id_empresa),
        id_tipo: Number(id_tipo),
        puntos_por_unidad: Number(puntos_por_unidad),
        co2_por_unidad: co2_por_unidad ?? 0.05,
        peso_kg_por_unidad: peso_kg_por_unidad ?? 0.03,
        observaciones,
        vigencia_inicio: vigencia_inicio ? new Date(vigencia_inicio) : null,
        vigencia_fin: vigencia_fin ? new Date(vigencia_fin) : null,
      },
      include: { tipo: true, empresa: { select: { nombre: true } } },
    });
    res.status(201).json(regla);
  } catch (err) {
    next(err);
  }
}

export async function actualizarRegla(req, res, next) {
  try {
    const id = Number(req.params.id);
    const data = { ...req.body };
    if (data.puntos_por_unidad != null) data.puntos_por_unidad = Number(data.puntos_por_unidad);
    delete data.id_regla;
    const regla = await prisma.reglaPunto.update({
      where: { id_regla: id },
      data,
      include: { tipo: true, empresa: { select: { nombre: true } } },
    });
    res.json(regla);
  } catch (err) {
    next(err);
  }
}

export async function listarQrs(_req, res, next) {
  try {
    const puntos = await prisma.puntoEcologico.findMany({
      orderBy: { id_punto: 'desc' },
      include: {
        empresa: { select: { nombre: true } },
        regla: { include: { tipo: true } },
        tipoReciclaje: true,
        _count: { select: { acciones: true } },
      },
    });
    const qrs = await Promise.all(
      puntos.map(async (p) => {
        const url = `${WEB_BASE}/punto/${p.qr_codigo}`;
        const qr_data_url = await QRCode.toDataURL(url, { margin: 1, width: 240 });
        return {
          id_punto: p.id_punto,
          nombre: p.nombre,
          nombre_campana: p.nombre_campana,
          qr_codigo: p.qr_codigo,
          estado: p.estado,
          empresa_nombre: p.empresa?.nombre,
          tipo: p.tipoReciclaje?.nombre ?? p.tipo_accion_permitida,
          puntos_por_unidad: p.regla?.puntos_por_unidad,
          escaneos: p._count.acciones,
          fecha_expiracion: p.fecha_expiracion,
          url,
          qr_data_url,
        };
      })
    );
    res.json(qrs);
  } catch (err) {
    next(err);
  }
}

export async function crearQr(req, res, next) {
  try {
    const {
      id_empresa,
      id_regla,
      id_tipo,
      nombre,
      nombre_campana,
      pregunta_label,
      pregunta_tipo,
      unidad,
      min_cantidad,
      max_cantidad,
      cooldown_horas,
      fecha_expiracion,
      qr_codigo,
    } = req.body;

    if (!id_empresa || !id_regla || !nombre) {
      throw new AppError('id_empresa, id_regla y nombre son requeridos', 400);
    }

    const regla = await prisma.reglaPunto.findUnique({
      where: { id_regla: Number(id_regla) },
      include: { tipo: true },
    });
    if (!regla) throw new AppError('Regla no encontrada', 404);
    if (regla.id_empresa !== Number(id_empresa)) {
      throw new AppError('La regla no pertenece a esta empresa', 400);
    }

    const codigo =
      qr_codigo?.trim() ||
      `QR_${slugify(nombre)}_${Date.now().toString(36).toUpperCase()}`;

    const empresaId = Number(id_empresa);
    const idTipo = id_tipo ? Number(id_tipo) : regla.id_tipo;

    const punto = await prisma.puntoEcologico.create({
      data: {
        nombre,
        nombre_campana,
        qr_codigo: codigo,
        tipo_accion_permitida: regla.tipo.codigo,
        pregunta_label:
          pregunta_label ||
          `¿Cuántos ${regla.tipo.unidad_medida} estás entregando?`,
        pregunta_tipo: pregunta_tipo || (regla.tipo.unidad_medida === 'kg' ? 'kilogramos' : 'numero'),
        unidad: unidad || regla.tipo.unidad_medida,
        min_cantidad: min_cantidad ?? 1,
        max_cantidad: max_cantidad ?? null,
        cooldown_horas: cooldown_horas ?? 4,
        fecha_expiracion: fecha_expiracion ? new Date(fecha_expiracion) : null,
        estado: 'activo',
        empresa: { connect: { id_empresa: empresaId } },
        regla: { connect: { id_regla: Number(id_regla) } },
        tipoReciclaje: { connect: { id_tipo: idTipo } },
      },
      include: {
        empresa: { select: { nombre: true } },
        regla: { include: { tipo: true } },
      },
    });

    res.status(201).json({
      ...punto,
      url_app: `${WEB_BASE}/punto/${punto.qr_codigo}`,
      regla_resumen: normalizarRegla(regla, punto.tipo_accion_permitida, punto.unidad),
    });
  } catch (err) {
    next(err);
  }
}

export async function actualizarQr(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { estado, fecha_expiracion, nombre_campana } = req.body;
    const punto = await prisma.puntoEcologico.update({
      where: { id_punto: id },
      data: {
        ...(estado != null ? { estado } : {}),
        ...(fecha_expiracion != null
          ? { fecha_expiracion: fecha_expiracion ? new Date(fecha_expiracion) : null }
          : {}),
        ...(nombre_campana != null ? { nombre_campana } : {}),
      },
    });
    res.json(punto);
  } catch (err) {
    next(err);
  }
}
