import { mapPrismaError } from '../utils/prismaErrors.js';

export function errorHandler(err, req, res, _next) {
  const prismaMapped = mapPrismaError(err);
  const status = prismaMapped?.statusCode || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  const message =
    prismaMapped?.message ||
    err.message ||
    'Error interno del servidor';

  if (status >= 500) {
    console.error('[API ERROR]', {
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      code: prismaMapped?.code || err.code,
      stack: err.stack,
    });
  } else {
    console.warn('[API]', req.method, req.originalUrl, message);
  }

  res.status(status).json({
    error: message,
    code: prismaMapped?.code || err.code || undefined,
    details: err.details || undefined,
    ...(isProd ? {} : { debug: err.message !== message ? err.message : undefined }),
  });
}

export class AppError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
