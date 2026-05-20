import { Prisma } from '@prisma/client';

const PRISMA_FRIENDLY = {
  P2002: 'Ya existe un registro con esos datos.',
  P2003: 'Referencia inválida: verifica empresa, regla o tipo de reciclaje.',
  P2025: 'No se encontró el registro solicitado.',
};

export function mapPrismaError(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      statusCode: err.code === 'P2025' ? 404 : 400,
      message: PRISMA_FRIENDLY[err.code] || 'No se pudo completar la operación en base de datos.',
      code: err.code,
    };
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      statusCode: 400,
      message:
        'Datos inválidos para la operación. Revisa relaciones (empresa, regla, tipo) y campos requeridos.',
      code: 'VALIDATION',
    };
  }
  return null;
}
