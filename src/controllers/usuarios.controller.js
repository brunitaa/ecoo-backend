import prisma from "../config/prisma.js";
import { calcularSaldo } from "../utils/saldo.js";
import { AppError } from "../middleware/errorHandler.js";

export async function getSaldo(req, res, next) {
  try {
    const id = Number(req.params.id);
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: id },
      select: { id_usuario: true, nombre: true },
    });
    if (!usuario) throw new AppError("Usuario no encontrado", 404);

    const saldo = await calcularSaldo(prisma, id);

    const impacto = await prisma.accion.aggregate({
      where: { id_usuario: id, estado_validacion: "aprobada" },
      _sum: { peso_kg: true, co2_evitado: true },
    });

    res.json({
      id_usuario: id,
      nombre: usuario.nombre,
      saldo,
      impacto: {
        kg_reciclados: Number(impacto._sum.peso_kg ?? 0),
        co2_evitado: Number(impacto._sum.co2_evitado ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUsuario(req, res, next) {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: Number(req.params.id) },
      select: {
        id_usuario: true,
        nombre: true,
        telefono: true,
        correo: true,
        foto_perfil_url: true,
        universidad: true,
        fecha_registro: true,
      },
    });
    if (!usuario) throw new AppError("Usuario no encontrado", 404);
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

export async function getRanking(_req, res, next) {
  try {
    const rows = await prisma.accion.groupBy({
      by: ["id_usuario"],
      where: { estado_validacion: "aprobada", id_usuario: { not: null } },
      _sum: { ecocoins_ganados: true, peso_kg: true },
      _count: { id_usuario: true },
      orderBy: { _sum: { ecocoins_ganados: "desc" } },
      take: 10,
    });

    const ids = rows.map((r) => r.id_usuario).filter(Boolean);
    const usuarios = await prisma.usuario.findMany({
      where: { id_usuario: { in: ids } },
      select: {
        id_usuario: true,
        nombre: true,
        universidad: true,
        foto_perfil_url: true,
      },
    });
    const map = Object.fromEntries(usuarios.map((u) => [u.id_usuario, u]));

    res.json(
      rows.map((r, i) => ({
        posicion: i + 1,
        id_usuario: r.id_usuario,
        nombre: map[r.id_usuario]?.nombre,
        universidad: map[r.id_usuario]?.universidad,
        ecocoins: Number(r._sum.ecocoins_ganados ?? 0),
        acciones: r._count.id_usuario,
        kg: Number(r._sum.peso_kg ?? 0),
      })),
    );
  } catch (err) {
    next(err);
  }
}

export async function getAccionesUsuario(req, res, next) {
  try {
    const acciones = await prisma.accion.findMany({
      where: { id_usuario: Number(req.params.id) },
      orderBy: { fecha_registro: "desc" },
      take: 20,
      select: {
        id_accion: true,
        estado_validacion: true,
        ecocoins_ganados: true,
        fecha_registro: true,
        motivo_rechazo: true,
        respuesta_resumen: true,
        cantidad_declarada: true,
        punto: {
          select: { nombre: true, tipo_accion_permitida: true, unidad: true },
        },
      },
    });

    res.json(
      acciones.map((a) => ({
        id_accion: a.id_accion,
        estado_validacion: a.estado_validacion,
        ecocoins_ganados: a.ecocoins_ganados,
        fecha_registro: a.fecha_registro,
        punto_nombre: a.punto?.nombre,
        tipo_accion_permitida: a.punto?.tipo_accion_permitida,
        motivo_rechazo: a.motivo_rechazo,
        respuesta_resumen:
          a.respuesta_resumen ??
          (a.cantidad_declarada != null && a.punto?.unidad
            ? `${Number(a.cantidad_declarada)} ${a.punto.unidad}`
            : null),
      })),
    );
  } catch (err) {
    next(err);
  }
}
