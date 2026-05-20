import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { signToken } from "../utils/jwt.js";
import { AppError } from "../middleware/errorHandler.js";

function verifyPassword(hash, password) {
  return Boolean(hash) && bcrypt.compare(password, hash);
}

const REDIRECTS = {
  ciudadano: process.env.URL_CIUDADANO || "http://localhost:5173",
  comercio: process.env.URL_CAJA || "http://localhost:5174",
  admin: process.env.URL_ADMIN || "http://localhost:5175",
};

function authResponse(rol, entity) {
  const base = {
    rol,
    redirectUrl: REDIRECTS[rol],
    token: signToken({
      rol,
      id: entity.id,
      nombre: entity.nombre,
      correo: entity.correo,
    }),
  };

  if (rol === "ciudadano") {
    return {
      ...base,
      user: {
        id_usuario: entity.id_usuario ?? entity.id,
        nombre: entity.nombre,
        correo: entity.correo,
        universidad: entity.universidad,
        foto_perfil_url: entity.foto_perfil_url,
      },
    };
  }
  if (rol === "comercio") {
    return {
      ...base,
      user: {
        id_empresa: entity.id_empresa ?? entity.id,
        nombre: entity.nombre,
        correo: entity.correo ?? entity.correo_contacto,
        tipo_empresa: entity.tipo_empresa,
      },
    };
  }
  return {
    ...base,
    user: {
      id_admin: entity.id_admin ?? entity.id,
      nombre: entity.nombre,
      correo: entity.correo,
      rol_admin: entity.rol,
    },
  };
}

export async function register(req, res, next) {
  try {
    const { nombre, telefono, correo, password, universidad } = req.body;
    if (!nombre || !telefono || !correo || !password) {
      throw new AppError(
        "nombre, telefono, correo y password son requeridos",
        400,
      );
    }
    if (password.length < 6) {
      throw new AppError("La contraseña debe tener al menos 6 caracteres", 400);
    }

    const exists = await prisma.usuario.findFirst({
      where: { OR: [{ correo }, { telefono }] },
    });
    if (exists) throw new AppError("Correo o teléfono ya registrado", 409);

    const password_hash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: { nombre, telefono, correo, password_hash, universidad },
    });

    res.status(201).json({
      mensaje: "Cuenta creada correctamente",
      ...authResponse("ciudadano", { ...usuario, id: usuario.id_usuario }),
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { correo, password, tipo } = req.body;
    if (!correo || !password || !tipo) {
      throw new AppError("correo, password y tipo son requeridos", 400);
    }

    if (tipo === "ciudadano") {
      const usuario = await prisma.usuario.findUnique({
        where: { correo },
        select: {
          id_usuario: true,
          nombre: true,
          correo: true,
          password_hash: true,
          estado: true,
          universidad: true,
          foto_perfil_url: true,
        },
      });
      const passwordMatches = await verifyPassword(
        usuario?.password_hash,
        password,
      );
      if (!usuario || !passwordMatches) {
        throw new AppError("Credenciales incorrectas", 401);
      }
      if (usuario.estado !== "activo") {
        throw new AppError("Cuenta desactivada", 403);
      }
      return res.json(
        authResponse("ciudadano", { ...usuario, id: usuario.id_usuario }),
      );
    }

    if (tipo === "comercio") {
      const empresa = await prisma.empresa.findUnique({
        where: { correo_contacto: correo },
        select: {
          id_empresa: true,
          nombre: true,
          correo_contacto: true,
          password_hash: true,
          estado: true,
          tipo_empresa: true,
        },
      });
      const passwordMatches = await verifyPassword(
        empresa?.password_hash,
        password,
      );
      if (!empresa || !passwordMatches) {
        throw new AppError("Credenciales incorrectas", 401);
      }
      if (empresa.estado !== "activo") {
        throw new AppError("Empresa no activa", 403);
      }
      return res.json(
        authResponse("comercio", {
          ...empresa,
          id: empresa.id_empresa,
          nombre: empresa.nombre,
          correo: empresa.correo_contacto,
        }),
      );
    }

    if (tipo === "admin") {
      const admin = await prisma.administrador.findUnique({
        where: { correo },
        select: {
          id_admin: true,
          nombre: true,
          correo: true,
          password_hash: true,
          rol: true,
        },
      });
      const passwordMatches = await verifyPassword(
        admin?.password_hash,
        password,
      );
      if (!admin || !passwordMatches) {
        throw new AppError("Credenciales incorrectas", 401);
      }
      return res.json(authResponse("admin", { ...admin, id: admin.id_admin }));
    }

    throw new AppError("tipo debe ser: ciudadano, comercio o admin", 400);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const { rol, id } = req.user;
    if (rol === "ciudadano") {
      const u = await prisma.usuario.findUnique({
        where: { id_usuario: id },
        select: {
          id_usuario: true,
          nombre: true,
          correo: true,
          universidad: true,
          foto_perfil_url: true,
          estado: true,
          fecha_registro: true,
        },
      });
      if (!u) throw new AppError("Usuario no encontrado", 404);
      return res.json({ rol, user: u });
    }
    if (rol === "comercio") {
      const e = await prisma.empresa.findUnique({
        where: { id_empresa: id },
        select: {
          id_empresa: true,
          nombre: true,
          correo_contacto: true,
          tipo_empresa: true,
          estado: true,
          estado_suscripcion: true,
          logo_url: true,
        },
      });
      if (!e) throw new AppError("Empresa no encontrada", 404);
      return res.json({ rol, user: e });
    }
    const a = await prisma.administrador.findUnique({
      where: { id_admin: id },
      select: { id_admin: true, nombre: true, correo: true, rol: true },
    });
    if (!a) throw new AppError("Admin no encontrado", 404);
    return res.json({ rol, user: a });
  } catch (err) {
    next(err);
  }
}
