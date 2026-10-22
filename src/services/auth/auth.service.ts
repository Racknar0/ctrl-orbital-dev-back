import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  }
  return secret;
};

const createAccessToken = (userId: string): string =>
  jwt.sign({}, getJwtSecret(), { subject: userId, expiresIn: '7d' });

const publicUser = (user: { id: string; name: string; email: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

export const register = async (input: RegisterInput) => {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const workspaceName = input.workspaceName.trim();

  if (!name || !workspaceName || !/^\S+@\S+\.\S+$/.test(email) || input.password.length < 8) {
    throw new AuthError('Revisa el nombre, el correo, el espacio y la contraseña (mínimo 8 caracteres).', 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) throw new AuthError('Ya existe una cuenta con ese correo.', 409);

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { name, email, passwordHash },
        select: { id: true, name: true, email: true },
      });
      const workspace = await transaction.workspace.create({ data: { name: workspaceName } });
      await transaction.workspaceMember.create({
        data: { userId: createdUser.id, workspaceId: workspace.id, role: 'OWNER' },
      });
      return { ...createdUser, workspace: { id: workspace.id, name: workspace.name } };
    });

    return { token: createAccessToken(user.id), user: publicUser(user), workspace: user.workspace };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new AuthError('Ya existe una cuenta con ese correo.', 409);
    }
    throw error;
  }
};

export const login = async (input: LoginInput) => {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AuthError('Correo o contraseña incorrectos.', 401);
  }

  const workspaceMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { workspace: { select: { id: true, name: true } } },
  });

  return {
    token: createAccessToken(user.id),
    user: publicUser(user),
    workspace: workspaceMembership?.workspace ?? null,
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { role: true, workspace: { select: { id: true, name: true, currency: true } } },
      },
    },
  });

  if (!user) throw new AuthError('La cuenta no existe.', 404);

  const { memberships, ...profile } = user;
  return { ...profile, workspace: memberships[0] ? { ...memberships[0].workspace, role: memberships[0].role } : null };
};

export const verifyAccessToken = (token: string): string => {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === 'string' || !payload.sub) throw new AuthError('Token inválido.', 401);
  return payload.sub;
};
