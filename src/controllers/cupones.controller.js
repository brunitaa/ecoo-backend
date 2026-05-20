import prisma, { withTransaction } from '../config/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export async function validarCaja(req, res, next) {
  try {
    const { codigo_unico } = req.body;
    if (!codigo_unico) {
      throw new AppError('codigo_unico (UUID del cupón) es requerido', 400);
    }

    const result = await withTransaction(async (tx) => {
      const cupon = await tx.cupon.findUnique({
        where: { codigo_unico },
        include: {
          recompensa: { select: { titulo: true, descripcion: true, id_recompensa: true } },
          usuario: { select: { nombre: true } },
        },
      });

      if (!cupon) throw new AppError('Cupón no encontrado', 404);

      if (cupon.estado === 'canjeado') {
        throw new AppError('Cupón ya fue canjeado anteriormente', 400, {
          estado: 'canjeado',
          fecha_canje: cupon.fecha_canje,
        });
      }

      if (cupon.estado === 'expirado') {
        throw new AppError('Cupón expirado', 400, { estado: 'expirado' });
      }

      if (cupon.estado !== 'disponible') {
        throw new AppError(`Estado de cupón no válido: ${cupon.estado}`, 400);
      }

      await tx.cupon.update({
        where: { id_cupon: cupon.id_cupon },
        data: { estado: 'canjeado', fecha_canje: new Date() },
      });

      await tx.recompensa.update({
        where: { id_recompensa: cupon.id_recompensa },
        data: { stock_reservado: { decrement: 1 } },
      });

      return {
        valido: true,
        titulo: cupon.recompensa.titulo,
        descripcion: cupon.recompensa.descripcion,
        usuario: cupon.usuario.nombre,
        codigo_unico: cupon.codigo_unico,
      };
    });

    res.json({
      mensaje: 'Cupón válido — canje registrado',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}
