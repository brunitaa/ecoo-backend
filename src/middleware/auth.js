import { verifyToken } from '../utils/jwt.js';
import { AppError } from './errorHandler.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Token de autenticación requerido', 401));
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    next(new AppError('Sesión inválida o expirada', 401));
  }
}
