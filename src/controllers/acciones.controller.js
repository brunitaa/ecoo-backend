import prisma from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  formatearRespuestaResumen,
  cargarReglaParaPunto,
  calcularRecompensaPorRegla,
  parseQrFromScan,
} from '../utils/ecocoins.js';

function validarPuntoActivo(punto) {
  if (!punto) throw new AppError('Punto ecológico no encontrado para este QR', 404);
  if (punto.estado !== 'activo') {
    throw new AppError('Este código QR no está activo', 403);
  }
  if (punto.fecha_expiracion && new Date(punto.fecha_expiracion) < new Date()) {
    throw new AppError('Este código QR ha expirado', 410);
  }
}

export async function registrarAccion(req, res, next) {
  try {
    const { id_usuario, qr_codigo, foto_url, cantidad_declarada } = req.body;

    if (!id_usuario || !qr_codigo || !foto_url || cantidad_declarada == null) {
      throw new AppError(
        'Campos requeridos: id_usuario, qr_codigo, cantidad_declarada, foto_url',
        400
      );
    }

    const codigo = parseQrFromScan(qr_codigo) || String(qr_codigo).trim();
    const cantidad = Number(cantidad_declarada);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      throw new AppError('La cantidad debe ser un número mayor a 0', 400);
    }

    const punto = await prisma.puntoEcologico.findUnique({
      where: { qr_codigo: codigo },
      include: { empresa: { select: { nombre: true, estado_suscripcion: true } } },
    });

    validarPuntoActivo(punto);
    if (punto.empresa?.estado_suscripcion === 'suspendida') {
      throw new AppError('La empresa afiliada no tiene suscripción activa', 403);
    }

    const min = Number(punto.min_cantidad);
    const max = punto.max_cantidad != null ? Number(punto.max_cantidad) : null;
    if (cantidad < min) {
      throw new AppError(`La cantidad mínima para este punto es ${min}`, 400);
    }
    if (max != null && cantidad > max) {
      throw new AppError(`La cantidad máxima para este punto es ${max}`, 400);
    }

    const cooldownMs = (punto.cooldown_horas ?? 4) * 60 * 60 * 1000;
    const desde = new Date(Date.now() - cooldownMs);
    const reciente = await prisma.accion.findFirst({
      where: {
        id_usuario: Number(id_usuario),
        id_punto: punto.id_punto,
        estado_validacion: { in: ['pendiente', 'aprobada', 'en_revision'] },
        fecha_registro: { gte: desde },
      },
    });

    if (reciente) {
      throw new AppError(
        `Ya registraste una acción en "${punto.nombre}" recientemente. Intenta de nuevo en ${punto.cooldown_horas} horas.`,
        429
      );
    }

    const regla = await cargarReglaParaPunto(prisma, punto);
    if (!regla) {
      throw new AppError('No hay regla de puntos vigente para este QR', 400);
    }

    const { ecocoins, peso_kg, co2_evitado, puntos_por_unidad } = calcularRecompensaPorRegla(
      regla,
      cantidad
    );

    const respuesta_resumen = formatearRespuestaResumen(
      punto.tipo_accion_permitida,
      cantidad,
      punto.unidad
    );

    const accion = await prisma.accion.create({
      data: {
        id_usuario: Number(id_usuario),
        id_punto: punto.id_punto,
        foto_url,
        cantidad_declarada: cantidad,
        respuesta_resumen,
        ecocoins_estimados: ecocoins,
        estado_validacion: 'pendiente',
        ia_metadatos: {
          qr_codigo: punto.qr_codigo,
          pregunta: punto.pregunta_label,
          puntos_por_unidad,
          id_regla: regla.id_regla,
        },
      },
      select: {
        id_accion: true,
        estado_validacion: true,
        fecha_registro: true,
        respuesta_resumen: true,
        ecocoins_estimados: true,
      },
    });

    res.status(201).json({
      mensaje: 'Solicitud enviada. Pendiente de aprobación por Ecoo.',
      accion,
      punto: {
        nombre: punto.nombre,
        tipo: punto.tipo_accion_permitida,
        empresa: punto.empresa?.nombre,
        campana: punto.nombre_campana,
      },
      recompensa: {
        cantidad,
        unidad: regla.unidad,
        puntos_por_unidad,
        ecocoins_estimados: ecocoins,
        desglose: `${cantidad} × ${puntos_por_unidad} = ${ecocoins} ECOO POINTS`,
      },
      impacto_estimado: { peso_kg, co2_evitado },
    });
  } catch (err) {
    next(err);
  }
}

export async function previewEcoCoins(req, res, next) {
  try {
    const codigo = parseQrFromScan(req.query.qr) || req.params.codigo;
    const cantidad = Number(req.query.cantidad ?? 1);
    const punto = await prisma.puntoEcologico.findUnique({
      where: { qr_codigo: String(codigo).trim() },
    });
    validarPuntoActivo(punto);
    const regla = await cargarReglaParaPunto(prisma, punto);
    const calc = calcularRecompensaPorRegla(regla, cantidad);
    res.json({
      cantidad,
      puntos_por_unidad: calc.puntos_por_unidad,
      ecocoins_estimados: calc.ecocoins,
      unidad: regla.unidad,
    });
  } catch (err) {
    next(err);
  }
}
