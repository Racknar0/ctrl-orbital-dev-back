import type { RequestHandler } from 'express';
import { PlatformRole } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export const requirePlatformAdmin: RequestHandler = async (_request, response, next) => {
  try {
    const userId = response.locals.userId as string | undefined;
    if (!userId) {
      response.status(401).json({ message: 'Inicia sesión para continuar.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true, isActive: true },
    });

    if (!user?.isActive || user.platformRole !== PlatformRole.ADMIN) {
      response.status(403).json({ message: 'Se requiere una cuenta administradora.' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
