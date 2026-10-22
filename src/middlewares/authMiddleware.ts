import type { RequestHandler } from 'express';
import { AuthError, verifyAccessToken } from '../services/auth/auth.service.js';

export const authMiddleware: RequestHandler = async (request, response, next) => {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) {
    response.status(401).json({ message: 'Inicia sesión para continuar.' });
    return;
  }

  try {
    response.locals.userId = await verifyAccessToken(token);
    next();
  } catch (error) {
    if (!(error instanceof AuthError) && !(error instanceof Error && ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name))) {
      next(error);
      return;
    }
    response.status(error instanceof AuthError ? error.statusCode : 401).json({ message: 'La sesión venció. Inicia sesión de nuevo.' });
  }
};
