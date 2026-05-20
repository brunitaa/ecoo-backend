import prisma, { withTransaction } from '../config/prisma.js';
import { calcularSaldo } from '../utils/saldo.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listarRecompensas(_req, res, next) {
  try {
    const rows = await prisma.recompensa.findMany({
      where: { estado: 'activo' },
      orderBy: { costo_ecocoins: 'asc' },
      include: { empresa: { select: { nombre: true } } },
    });

    res.json(
      rows.map((r) => ({
        ...r,
        empresa_nombre: r.empresa?.nombre ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
}

export async function canjearRecompensa(req, res, next) {
  try {
    const { id_usuario, id_recompensa } = req.body;
    if (!id_usuario || !id_recompensa) {
      throw new AppError('id_usuario e id_recompensa son requeridos', 400);
    }

    const result = await withTransaction(async (tx) => {
      const recompensa = await tx.recompensa.findUnique({
        where: { id_recompensa: Number(id_recompensa) },
      });

      if (!recompensa) throw new AppError('Recompensa no encontrada', 404);
      if (recompensa.estado !== 'activo') {
        throw new AppError('Esta recompensa no está disponible', 400);
      }
      if (recompensa.stock_disponible <= 0) {
        throw new AppError('Sin stock disponible para esta recompensa', 400);
      }

      const saldo = await calcularSaldo(tx, id_usuario);
      if (saldo < recompensa.costo_ecocoins) {
        throw new AppError(
          `Saldo insuficiente. Tienes ${saldo} EC, necesitas ${recompensa.costo_ecocoins} EC`,
          400,
          { saldo, costo: recompensa.costo_ecocoins }
        );
      }

      await tx.recompensa.update({
        where: { id_recompensa: recompensa.id_recompensa },
        data: {
          stock_disponible: { decrement: 1 },
          stock_reservado: { increment: 1 },
        },
      });

      const cupon = await tx.cupon.create({
        data: {
          id_usuario: Number(id_usuario),
          id_recompensa: recompensa.id_recompensa,
          estado: 'disponible',
        },
        select: {
          id_cupon: true,
          codigo_unico: true,
          fecha_generacion: true,
        },
      });

      await tx.transaccionEcocoin.create({
        data: {
          id_usuario: Number(id_usuario),
          tipo: 'debito',
          monto: recompensa.costo_ecocoins,
          id_cupon_destino: cupon.id_cupon,
        },
      });

      const saldo_restante = await calcularSaldo(tx, id_usuario);

      return {
        cupon,
        recompensa: {
          titulo: recompensa.titulo,
          costo_ecocoins: recompensa.costo_ecocoins,
        },
        saldo_restante,
      };
    });

    res.status(201).json({
      mensaje: 'Canje realizado correctamente',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}
