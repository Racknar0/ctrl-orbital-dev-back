import type { RequestHandler } from 'express';
import { AuthError, getCurrentUser, login, register } from '../../services/auth/auth.service.js';

export const registerController: RequestHandler = async (request, response, next) => {
  try {
    const { name, email, password, workspaceName } = request.body ?? {};
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof workspaceName !== 'string'
    ) {
      response.status(400).json({ message: 'Nombre, correo, contraseña y nombre del espacio son requeridos.' });
      return;
    }
    const result = await register({ name, email, password, workspaceName });
    response.status(201).json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
};

export const loginController: RequestHandler = async (request, response, next) => {
  try {
    const { email, password } = request.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      response.status(400).json({ message: 'Correo y contraseña son requeridos.' });
      return;
    }
    response.json(await login({ email, password }));
  } catch (error) {
    if (error instanceof AuthError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
};

export const currentUserController: RequestHandler = async (_request, response, next) => {
  try {
    const userId = response.locals.userId as string | undefined;
    if (!userId) throw new AuthError('Sesión no válida.', 401);
    response.json({ user: await getCurrentUser(userId) });
  } catch (error) {
    if (error instanceof AuthError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
};
