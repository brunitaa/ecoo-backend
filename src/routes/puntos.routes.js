import { Router } from 'express';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { cargarReglaParaPunto, calcularRecompensaPorRegla } from '../utils/ecocoins.js';

const WEB_BASE = process.env.WEB_CIUDADANO_URL || 'http://localhost:5173';

const router = Router();

router.get('/qr/:codigo', async (req, res, next) => {
  try {
    const punto = await prisma.puntoEcologico.findUnique({
      where: { qr_codigo: req.params.codigo },
      include: {
        empresa: { select: { nombre: true, estado_suscripcion: true } },
        regla: { include: { tipo: true } },
        tipoReciclaje: true,
      },
    });
    if (!punto) throw new AppError('Punto no encontrado', 404);
    if (punto.estado !== 'activo') {
      throw new AppError('Este punto ecológico no está activo', 403);
    }
    if (punto.fecha_expiracion && new Date(punto.fecha_expiracion) < new Date()) {
      throw new AppError('Este código QR ha expirado', 410);
    }

    const regla = await cargarReglaParaPunto(prisma, punto);
    const preview = calcularRecompensaPorRegla(regla, 1);

    res.json({
      id_punto: punto.id_punto,
      nombre: punto.nombre,
      nombre_campana: punto.nombre_campana,
      qr_codigo: punto.qr_codigo,
      tipo_accion_permitida: punto.tipo_accion_permitida,
      estado: punto.estado,
      fecha_expiracion: punto.fecha_expiracion,
      empresa_nombre: punto.empresa?.nombre,
      tipo_reciclaje: punto.tipoReciclaje?.nombre ?? regla.tipo?.nombre,
      formulario: {
        pregunta_label: punto.pregunta_label,
        pregunta_tipo: punto.pregunta_tipo,
        unidad: punto.unidad,
        min_cantidad: Number(punto.min_cantidad),
        max_cantidad: punto.max_cantidad != null ? Number(punto.max_cantidad) : null,
        placeholder: punto.pregunta_tipo === 'kilogramos' ? 'Ej: 2.5' : 'Ej: 5',
      },
      recompensa: {
        puntos_por_unidad: preview.puntos_por_unidad,
        unidad: regla.unidad,
        etiqueta_unidad: regla.tipo?.unidad_medida ?? punto.unidad,
      },
      url_app: `${WEB_BASE}/punto/${punto.qr_codigo}`,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/qr/:codigo/estimar', async (req, res, next) => {
  try {
    const cantidad = Number(req.query.cantidad ?? 1);
    const punto = await prisma.puntoEcologico.findUnique({
      where: { qr_codigo: req.params.codigo },
    });
    if (!punto) throw new AppError('Punto no encontrado', 404);
    const regla = await cargarReglaParaPunto(prisma, punto);
    const calc = calcularRecompensaPorRegla(regla, cantidad);
    res.json({
      cantidad,
      puntos_por_unidad: calc.puntos_por_unidad,
      ecocoins_estimados: calc.ecocoins,
      unidad: regla.unidad,
      desglose: `${cantidad} × ${calc.puntos_por_unidad} = ${calc.ecocoins} ECOO POINTS`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
