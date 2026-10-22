import bcrypt from 'bcrypt';
import { PlatformRole, Prisma } from '@prisma/client';
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
  isActive?: boolean;
};

export type UserCreateInput = {
  name: string;
  email: string;
  password: string;
  platformRole: PlatformRole;
};

type DeletionMembership = { role: string; workspace: { _count: { members: number } } };

const deletionBlockedReason = (memberships: DeletionMembership[]): string | null => {
  // El esquema actual no tiene gastos vinculados a cuentas. Solo se admite el espacio inicial exclusivo.
  if (memberships.length > 1 || memberships.some((membership) => membership.role !== 'OWNER' || membership.workspace._count.members !== 1)) {
    return 'Este usuario tiene actividad o vínculos compartidos. Puedes desactivarlo, pero no eliminarlo.';
  }
  return null;
};

export const listUsers = async () => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      isActive: true,
      createdAt: true,
      memberships: { select: { role: true, workspace: { select: { _count: { select: { members: true } } } } } },
    },
  });

  return users.map(({ memberships, ...user }) => ({
    ...user,
    workspaceCount: memberships.length,
    deletionBlockedReason: deletionBlockedReason(memberships),
  }));
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
        select: { id: true, name: true, email: true, platformRole: true, isActive: true, createdAt: true },
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
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (!Object.keys(data).length) throw new UserManagementError('Envía al menos un campo para actualizar.', 400);

  try {
    return await prisma.$transaction(async (transaction) => {
      await assertActiveAdmin(transaction, actorUserId);
      const currentUser = await transaction.user.findUnique({ where: { id: userId } });
      if (!currentUser) throw new UserManagementError('No se encontró el usuario.', 404);
      if (actorUserId === userId && (data.platformRole === PlatformRole.USER || data.isActive === false)) {
        throw new UserManagementError('No puedes desactivar tu propia cuenta ni quitarte el rol de administrador.', 409);
      }
      if (data.platformRole === PlatformRole.USER || data.isActive === false) {
        await assertAnotherActiveAdmin(transaction, currentUser);
      }
      if (data.isActive === false) {
        await transaction.authToken.deleteMany({ where: { userId } });
      }
      return transaction.user.update({
        where: { id: userId },
        data: { ...data, ...(data.isActive === false && currentUser.isActive ? { sessionVersion: { increment: 1 } } : {}) },
        select: { id: true, name: true, email: true, platformRole: true, isActive: true, createdAt: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new UserManagementError('Ya existe una cuenta con ese correo.', 409);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new UserManagementError('La cuenta cambió mientras la modificabas. Actualiza la lista e inténtalo de nuevo.', 409);
    }
    throw error;
  }
};

const assertActiveAdmin = async (transaction: Prisma.TransactionClient, actorUserId: string) => {
  const actor = await transaction.user.findUnique({ where: { id: actorUserId } });
  if (!actor?.isActive || actor.platformRole !== PlatformRole.ADMIN) {
    throw new UserManagementError('Se requiere una cuenta administradora activa.', 403);
  }
};

const assertAnotherActiveAdmin = async (
  transaction: Prisma.TransactionClient,
  user: { id: string; platformRole: PlatformRole; isActive: boolean },
) => {
  if (user.platformRole !== PlatformRole.ADMIN || !user.isActive) return;
  const remaining = await transaction.user.count({
    where: { id: { not: user.id }, platformRole: PlatformRole.ADMIN, isActive: true },
  });
  if (remaining === 0) throw new UserManagementError('Debe permanecer al menos un administrador activo.', 409);
};

export const deleteUser = async (userId: string, actorUserId: string, emailConfirmation: string) => {
  if (userId === actorUserId) throw new UserManagementError('No puedes eliminar tu propia cuenta desde administración.', 409);
  try {
    return await prisma.$transaction(async (transaction) => {
      await assertActiveAdmin(transaction, actorUserId);
      const user = await transaction.user.findUnique({
        where: { id: userId },
        include: { memberships: { include: { workspace: { select: { _count: { select: { members: true } } } } } } },
      });
      if (!user) throw new UserManagementError('No se encontró el usuario.', 404);
      if (emailConfirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
        throw new UserManagementError('Escribe el correo del usuario para confirmar la eliminación.', 400);
      }
      if (user.isActive) throw new UserManagementError('Primero desactiva la cuenta antes de eliminarla definitivamente.', 409);
      await assertAnotherActiveAdmin(transaction, user);

      const blockedReason = deletionBlockedReason(user.memberships);
      if (blockedReason) throw new UserManagementError(blockedReason, 409);
      const exclusiveWorkspaceIds = user.memberships.map((membership) => membership.workspaceId);

      await transaction.user.delete({ where: { id: userId } });
      if (exclusiveWorkspaceIds.length) {
        await transaction.workspace.deleteMany({ where: { id: { in: exclusiveWorkspaceIds } } });
      }
      return { message: 'Usuario sin actividad eliminado definitivamente, junto con sus tokens y su espacio vacío.' };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new UserManagementError('Los datos cambiaron durante la eliminación. Actualiza la lista e inténtalo de nuevo.', 409);
    }
    throw error;
  }
};
