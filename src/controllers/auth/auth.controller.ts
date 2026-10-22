import type { RequestHandler } from 'express';
import {
  AuthError,
  getCurrentUser,
  login,
  register,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from '../../services/auth/auth.service.js';

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

export const verifyEmailController: RequestHandler = async (request, response, next) => {
  try {
    const { token } = request.body ?? {};
    if (typeof token !== 'string' || !token) {
      response.status(400).json({ message: 'Falta el enlace de verificación.' });
      return;
    }
    response.json(await verifyEmail(token));
  } catch (error) {
    if (error instanceof AuthError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
};

export const forgotPasswordController: RequestHandler = async (request, response, next) => {
  try {
    const { email } = request.body ?? {};
    if (typeof email !== 'string') {
      response.status(400).json({ message: 'Escribe el correo de tu cuenta.' });
      return;
    }
    response.json(await requestPasswordReset(email));
  } catch (error) {
    if (error instanceof AuthError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
};

export const resetPasswordController: RequestHandler = async (request, response, next) => {
  try {
    const { token, password } = request.body ?? {};
    if (typeof token !== 'string' || !token || typeof password !== 'string') {
      response.status(400).json({ message: 'El enlace y la contraseña nueva son requeridos.' });
      return;
    }
    response.json(await resetPassword(token, password));
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
