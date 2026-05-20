import prisma, { withTransaction } from '../config/prisma.js';
import { calcularSaldo } from '../utils/saldo.js';
import {
  cargarReglaParaPunto,
  calcularRecompensaPorRegla,
  estimarEcoCoins,
} from '../utils/ecocoins.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listarPendientes(_req, res, next) {
  try {
    const acciones = await prisma.accion.findMany({
      where: { estado_validacion: 'pendiente' },
      orderBy: { fecha_registro: 'asc' },
      include: {
        usuario: { select: { id_usuario: true, nombre: true, universidad: true } },
        punto: {
          select: {
            nombre: true,
            tipo_accion_permitida: true,
            unidad: true,
            id_regla: true,
            id_punto: true,
            empresa: { select: { nombre: true } },
          },
        },
      },
    });

    const enriched = await Promise.all(
      acciones.map(async (a) => {
        const historial_aprobadas = await prisma.accion.count({
          where: { id_usuario: a.id_usuario, estado_validacion: 'aprobada' },
        });
        const cantidad = Number(a.cantidad_declarada ?? 1);
        const regla =
          a.ecocoins_estimados > 0
            ? { puntos_por_unidad: Math.round(a.ecocoins_estimados / cantidad) || 5 }
            : a.punto
              ? await cargarReglaParaPunto(prisma, a.punto)
              : { puntos_por_unidad: 5 };
        const ecocoins_propuestos =
          a.ecocoins_estimados > 0
            ? a.ecocoins_estimados
            : estimarEcoCoins(regla, cantidad);
        return {
          id_accion: a.id_accion,
          foto_url: a.foto_url,
          fecha_registro: a.fecha_registro,
          estado_validacion: a.estado_validacion,
          cantidad_declarada: cantidad,
          respuesta_resumen: a.respuesta_resumen,
          id_usuario: a.usuario?.id_usuario,
          usuario_nombre: a.usuario?.nombre,
          universidad: a.usuario?.universidad,
          punto_nombre: a.punto?.nombre,
          tipo_accion_permitida: a.punto?.tipo_accion_permitida,
          empresa_nombre: a.punto?.empresa?.nombre,
          historial_aprobadas,
          ecocoins_propuestos,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    next(err);
  }
}

export async function verificarAccion(req, res, next) {
  try {
    const {
      id_accion,
      id_admin,
      aprobado,
      veredicto,
      motivo_rechazo,
      ecocoins_ganados,
    } = req.body;

    const esAprobada =
      veredicto === 'aprobada' || aprobado === true || aprobado === 'true';
    const esRechazada =
      veredicto === 'rechazada' || aprobado === false || aprobado === 'false';

    if (!id_accion || id_admin == null || (!esAprobada && !esRechazada)) {
      throw new AppError(
        'id_accion, id_admin y veredicto (aprobada|rechazada) son requeridos',
        400
      );
    }

    if (esRechazada && !motivo_rechazo?.trim()) {
      throw new AppError('motivo_rechazo es obligatorio al rechazar', 400);
    }

    const result = await withTransaction(async (tx) => {
      const accion = await tx.accion.findUnique({
        where: { id_accion: Number(id_accion) },
        include: {
          punto: {
            select: {
              tipo_accion_permitida: true,
              unidad: true,
              id_regla: true,
              id_punto: true,
            },
          },
        },
      });

      if (!accion) throw new AppError('Acción no encontrada', 404);
      if (accion.estado_validacion !== 'pendiente') {
        throw new AppError(`La acción ya fue procesada (${accion.estado_validacion})`, 400);
      }

      if (esRechazada) {
        await tx.accion.update({
          where: { id_accion: accion.id_accion },
          data: {
            estado_validacion: 'rechazada',
            motivo_rechazo: motivo_rechazo.trim(),
            id_admin_validador: Number(id_admin),
            tipo_validador: 'manual',
            fecha_validacion: new Date(),
          },
        });
        return { id_accion: accion.id_accion, estado: 'rechazada', motivo_rechazo };
      }

      const cantidad = Number(accion.cantidad_declarada ?? 1);
      let coins = ecocoins_ganados ?? accion.ecocoins_estimados;
      let peso_kg = 0;
      let co2_evitado = 0;
      if (!coins && accion.punto) {
        const reglaCalc = await cargarReglaParaPunto(tx, accion.punto);
        const calc = calcularRecompensaPorRegla(reglaCalc, cantidad);
        coins = calc.ecocoins;
        peso_kg = calc.peso_kg;
        co2_evitado = calc.co2_evitado;
      } else if (accion.punto) {
        const reglaCalc = await cargarReglaParaPunto(tx, accion.punto);
        const calc = calcularRecompensaPorRegla(reglaCalc, cantidad);
        peso_kg = calc.peso_kg;
        co2_evitado = calc.co2_evitado;
      }

      await tx.accion.update({
        where: { id_accion: accion.id_accion },
        data: {
          estado_validacion: 'aprobada',
          ecocoins_ganados: coins,
          peso_kg,
          co2_evitado,
          id_admin_validador: Number(id_admin),
          tipo_validador: 'manual',
          fecha_validacion: new Date(),
          motivo_rechazo: null,
        },
      });

      await tx.transaccionEcocoin.create({
        data: {
          id_usuario: accion.id_usuario,
          tipo: 'credito',
          monto: coins,
          id_accion_origen: accion.id_accion,
        },
      });

      const saldo_usuario = await calcularSaldo(tx, accion.id_usuario);

      return {
        id_accion: accion.id_accion,
        estado: 'aprobada',
        ecocoins_ganados: coins,
        saldo_usuario,
      };
    });

    res.json({ mensaje: 'Veredicto registrado', ...result });
  } catch (err) {
    next(err);
  }
}

export async function listarProcesadas(_req, res, next) {
  try {
    const rows = await prisma.accion.findMany({
      where: { estado_validacion: { in: ['aprobada', 'rechazada'] } },
      orderBy: { fecha_validacion: 'desc' },
      take: 15,
      include: {
        usuario: { select: { nombre: true } },
        punto: { select: { tipo_accion_permitida: true, nombre: true } },
      },
    });

    res.json(
      rows.map((a) => ({
        id_accion: a.id_accion,
        estado_validacion: a.estado_validacion,
        ecocoins_ganados: a.ecocoins_ganados,
        motivo_rechazo: a.motivo_rechazo,
        respuesta_resumen: a.respuesta_resumen,
        fecha_validacion: a.fecha_validacion,
        usuario_nombre: a.usuario?.nombre,
        punto_nombre: a.punto?.nombre,
        tipo_accion_permitida: a.punto?.tipo_accion_permitida,
      }))
    );
  } catch (err) {
    next(err);
  }
}
