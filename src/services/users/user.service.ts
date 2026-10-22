import bcrypt from 'bcrypt';
import { PlatformRole } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';

export class UserManagementError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'UserManagementError';
  }
}

export type UserUpdateInput = {
  name?: string;
  email?: string;
  platformRole?: PlatformRole;
};

export type UserCreateInput = {
  name: string;
  email: string;
  password: string;
  platformRole: PlatformRole;
};

export const listUsers = async () => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });

  return users.map(({ _count, ...user }) => ({ ...user, workspaceCount: _count.memberships }));
};

export const createUser = async (input: UserCreateInput) => {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) throw new UserManagementError('El nombre no puede quedar vacío.', 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new UserManagementError('Escribe un correo válido.', 400);
  if (input.password.length < 8) throw new UserManagementError('La contraseña debe tener al menos 8 caracteres.', 400);

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name, email, passwordHash, platformRole: input.platformRole, emailVerifiedAt: new Date() },
        select: { id: true, name: true, email: true, platformRole: true, createdAt: true },
      });
      const workspace = await transaction.workspace.create({
        data: { name: `${name} - Espacio`, currency: 'COP' },
      });
      await transaction.workspaceMember.create({
        data: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
      });

      return { ...user, workspaceCount: 1 };
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new UserManagementError('Ya existe una cuenta con ese correo.', 409);
    }
    throw error;
  }
};

export const updateUser = async (userId: string, actorUserId: string, input: UserUpdateInput) => {
  const data: UserUpdateInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new UserManagementError('El nombre no puede quedar vacío.', 400);
    data.name = name;
  }

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new UserManagementError('Escribe un correo válido.', 400);
    data.email = email;
  }

  if (input.platformRole !== undefined) data.platformRole = input.platformRole;
  if (!Object.keys(data).length) throw new UserManagementError('Envía al menos un campo para actualizar.', 400);

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, platformRole: true },
  });
  if (!currentUser) throw new UserManagementError('No se encontró el usuario.', 404);

  if (actorUserId === userId && data.platformRole === PlatformRole.USER) {
    throw new UserManagementError('No puedes quitarte tu propio rol de administrador.', 409);
  }

  if (currentUser.platformRole === PlatformRole.ADMIN && data.platformRole === PlatformRole.USER) {
    const adminCount = await prisma.user.count({ where: { platformRole: PlatformRole.ADMIN } });
    if (adminCount <= 1) throw new UserManagementError('Debe permanecer al menos un administrador.', 409);
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new UserManagementError('Ya existe una cuenta con ese correo.', 409);
    }
    throw error;
  }
};
