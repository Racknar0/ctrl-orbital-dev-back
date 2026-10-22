import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthTokenType, type PlatformRole } from '@prisma/client';
import {
  assertEmailDeliveryConfigured,
  EmailDeliveryError,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../../utils/authEmail.js';
import { prisma } from '../../utils/prisma.js';

export class AuthError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'AuthError';
  }
}

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
};

type LoginInput = Pick<RegisterInput, 'email' | 'password'>;

const emailVerificationLifetimeMs = 24 * 60 * 60 * 1000;
const passwordResetLifetimeMs = 60 * 60 * 1000;
const genericPasswordResetMessage = 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.';

const createRawToken = () => randomBytes(32).toString('base64url');
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const createAuthToken = async (userId: string, type: AuthTokenType, lifetimeMs: number) => {
  const token = createRawToken();
  await prisma.$transaction(async (transaction) => {
    await transaction.authToken.deleteMany({ where: { userId, type } });
    await transaction.authToken.create({
      data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + lifetimeMs) },
    });
  });
  return token;
};

const findValidAuthToken = (token: string, type: AuthTokenType) =>
  prisma.authToken.findFirst({
    where: { tokenHash: hashToken(token), type, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, name: true, email: true, emailVerifiedAt: true, isActive: true } } },
  });

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  }
  return secret;
};

const createAccessToken = (userId: string, sessionVersion: number): string =>
  jwt.sign({ sessionVersion }, getJwtSecret(), { subject: userId, expiresIn: '7d' });

const publicUser = (user: { id: string; name: string; email: string; platformRole: PlatformRole }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  platformRole: user.platformRole,
});

export const register = async (input: RegisterInput) => {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const workspaceName = input.workspaceName.trim();

  if (!name || !workspaceName || !/^\S+@\S+\.\S+$/.test(email) || input.password.length < 8) {
    throw new AuthError('Revisa el nombre, el correo, el espacio y la contraseña (mínimo 8 caracteres).', 400);
  }

  try {
    assertEmailDeliveryConfigured();
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw new AuthError(error.message, 503);
    throw error;
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) throw new AuthError('Ya existe una cuenta con ese correo.', 409);

  const passwordHash = await bcrypt.hash(input.password, 12);
  const verificationToken = createRawToken();
  let created: { user: { id: string; name: string }; workspaceId: string };

  try {
    created = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name, email, passwordHash },
        select: { id: true, name: true },
      });
      const workspace = await transaction.workspace.create({ data: { name: workspaceName } });
      await transaction.workspaceMember.create({
        data: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
      });
      await transaction.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(verificationToken),
          type: AuthTokenType.EMAIL_VERIFICATION,
          expiresAt: new Date(Date.now() + emailVerificationLifetimeMs),
        },
      });
      return { user, workspaceId: workspace.id };
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new AuthError('Ya existe una cuenta con ese correo.', 409);
    }
    throw error;
  }

  try {
    await sendVerificationEmail(email, name, verificationToken);
  } catch (error) {
    console.error('No se pudo enviar el correo de verificación.');
    await prisma.$transaction(async (transaction) => {
      await transaction.user.delete({ where: { id: created.user.id } });
      await transaction.workspace.delete({ where: { id: created.workspaceId } });
    });
    throw new AuthError(
      error instanceof EmailDeliveryError
        ? error.message
        : 'No pudimos enviar el correo de verificación. Inténtalo de nuevo más tarde.',
      503,
    );
  }

  return { message: 'Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión.' };
};

export const verifyEmail = async (token: string) => {
  const authToken = await findValidAuthToken(token, AuthTokenType.EMAIL_VERIFICATION);
  if (!authToken || !authToken.user.isActive) throw new AuthError('El enlace de verificación no es válido o ya venció.', 400);

  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.authToken.deleteMany({
      where: { id: authToken.id, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) throw new AuthError('El enlace de verificación no es válido o ya venció.', 400);
    await transaction.user.update({ where: { id: authToken.userId }, data: { emailVerifiedAt: new Date() } });
    await transaction.authToken.deleteMany({ where: { userId: authToken.userId, type: AuthTokenType.EMAIL_VERIFICATION } });
  });

  return { message: 'Correo verificado. Ya puedes iniciar sesión.' };
};

export const requestPasswordReset = async (rawEmail: string) => {
  const email = rawEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { message: genericPasswordResetMessage };

  try {
    assertEmailDeliveryConfigured();
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw new AuthError(error.message, 503);
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !user.emailVerifiedAt) return { message: genericPasswordResetMessage };

  const token = await createAuthToken(user.id, AuthTokenType.PASSWORD_RESET, passwordResetLifetimeMs);
  try {
    await sendPasswordResetEmail(user.email, user.name, token);
  } catch {
    await prisma.authToken.deleteMany({
      where: { userId: user.id, type: AuthTokenType.PASSWORD_RESET, tokenHash: hashToken(token) },
    });
    console.error('No se pudo enviar el correo para restablecer la contraseña.');
  }

  return { message: genericPasswordResetMessage };
};

export const resetPassword = async (token: string, password: string) => {
  if (password.length < 8) throw new AuthError('La contraseña debe tener al menos 8 caracteres.', 400);
  const authToken = await findValidAuthToken(token, AuthTokenType.PASSWORD_RESET);
  if (!authToken || !authToken.user.isActive) throw new AuthError('El enlace de recuperación no es válido o ya venció.', 400);

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.authToken.deleteMany({
      where: { id: authToken.id, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) throw new AuthError('El enlace de recuperación no es válido o ya venció.', 400);
    await transaction.user.update({ where: { id: authToken.userId }, data: { passwordHash } });
    await transaction.authToken.deleteMany({ where: { userId: authToken.userId } });
  });

  return { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
};

export const login = async (input: LoginInput) => {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AuthError('Correo o contraseña incorrectos.', 401);
  }

  if (!user.isActive) throw new AuthError('Tu cuenta está desactivada. Contacta al administrador.', 403);

  if (!user.emailVerifiedAt) {
    throw new AuthError('Verifica tu correo antes de iniciar sesión.', 403);
  }

  const workspaceMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { workspace: { select: { id: true, name: true } } },
  });

  return {
    token: createAccessToken(user.id, user.sessionVersion),
    user: publicUser(user),
    workspace: workspaceMembership ? { ...workspaceMembership.workspace, role: workspaceMembership.role } : null,
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      isActive: true,
      memberships: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { role: true, workspace: { select: { id: true, name: true, currency: true } } },
      },
    },
  });

  if (!user) throw new AuthError('La cuenta no existe.', 404);
  if (!user.isActive) throw new AuthError('Tu cuenta está desactivada.', 401);

  const { memberships, ...profile } = user;
  return { ...profile, workspace: memberships[0] ? { ...memberships[0].workspace, role: memberships[0].role } : null };
};

export const verifyAccessToken = async (token: string): Promise<string> => {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === 'string' || !payload.sub) throw new AuthError('Token inválido.', 401);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { isActive: true, sessionVersion: true },
  });
  // Los tokens anteriores a esta migración corresponden a la versión inicial (0).
  if (!user?.isActive || (payload.sessionVersion ?? 0) !== user.sessionVersion) {
    throw new AuthError('La sesión ya no está disponible. Inicia sesión de nuevo.', 401);
  }
  return payload.sub;
};
