import type { RequestHandler } from 'express';
import { PlatformRole } from '@prisma/client';
import { UserManagementError, createUser, deleteUser, listUsers, updateUser } from '../../services/users/user.service.js';

export const listUsersController: RequestHandler = async (_request, response, next) => {
  try {
    response.json({ users: await listUsers() });
  } catch (error) {
    next(error);
  }
};

export const createUserController: RequestHandler = async (request, response, next) => {
  try {
    const { name, email, password, platformRole = PlatformRole.USER } = request.body ?? {};
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !Object.values(PlatformRole).includes(platformRole)
    ) {
      response.status(400).json({ message: 'Envía nombre, correo, contraseña y un rol válido.' });
      return;
    }

    const user = await createUser({ name, email, password, platformRole });
    response.status(201).json({ user });
  } catch (error) {
    if (error instanceof UserManagementError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
};

export const updateUserController: RequestHandler = async (request, response, next) => {
  try {
    const { name, email, platformRole, isActive } = request.body ?? {};
    if (
      (name !== undefined && typeof name !== 'string') ||
      (email !== undefined && typeof email !== 'string') ||
      (platformRole !== undefined && !Object.values(PlatformRole).includes(platformRole)) ||
      (isActive !== undefined && typeof isActive !== 'boolean')
    ) {
      response.status(400).json({ message: 'Revisa el nombre, correo, rol y estado enviados.' });
      return;
    }

    const userId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    if (!userId) {
      response.status(400).json({ message: 'Falta el identificador del usuario.' });
      return;
    }

    const actorUserId = response.locals.userId as string | undefined;
    if (!actorUserId) {
      response.status(401).json({ message: 'Inicia sesión para continuar.' });
      return;
    }

    const user = await updateUser(userId, actorUserId, { name, email, platformRole, isActive });
    response.json({ user });
  } catch (error) {
    if (error instanceof UserManagementError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
};

export const deleteUserController: RequestHandler = async (request, response, next) => {
  try {
    const userId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const actorUserId = response.locals.userId as string | undefined;
    if (!actorUserId) {
      response.status(401).json({ message: 'Inicia sesión para continuar.' });
      return;
    }
    const { emailConfirmation } = request.body ?? {};
    if (!userId || typeof emailConfirmation !== 'string') {
      response.status(400).json({ message: 'Envía el identificador y el correo de confirmación del usuario.' });
      return;
    }
    response.json(await deleteUser(userId, actorUserId, emailConfirmation));
  } catch (error) {
    if (error instanceof UserManagementError) {
      response.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
};
