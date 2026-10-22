import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';

export class QuickRoomError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const text = (value: unknown, label: string, max = 80): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new QuickRoomError(`${label}: escribe entre 1 y ${max} caracteres.`);
  }
  return value.trim();
};
const cents = (value: { toString(): string }) => Math.round(Number(value.toString()) * 100);
const decimal = (value: number) => (value / 100).toFixed(2);
const parseAmount = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{1,10}(\.\d{1,2})?$/.test(value)) {
    throw new QuickRoomError('Escribe un importe positivo con hasta dos decimales.');
  }
  const result = cents(value);
  if (result <= 0 || result > 100_000_000_000) throw new QuickRoomError('Importe fuera de rango.');
  return result;
};
const includeRoom = {
  participants: { orderBy: { createdAt: 'asc' as const } },
  expenses: { include: { shares: true }, orderBy: { createdAt: 'desc' as const } },
  settlements: { orderBy: { createdAt: 'desc' as const } },
};
type Room = Prisma.QuickRoomGetPayload<{ include: typeof includeRoom }>;
type Transaction = Prisma.TransactionClient;
type Body = Record<string, unknown>;

function balances(room: Room) {
  const result = Object.fromEntries(room.participants.map((p) => [p.id, 0]));
  for (const expense of room.expenses) {
    result[expense.paidByParticipantId] += cents(expense.amount);
    for (const share of expense.shares) result[share.participantId] -= cents(share.amount);
  }
  for (const payment of room.settlements) {
    if (payment.status !== 'CONFIRMED') continue;
    result[payment.fromParticipantId] += cents(payment.amount);
    result[payment.toParticipantId] -= cents(payment.amount);
  }
  return result;
}

function publicRoom(room: Room, me: string) {
  const balance = balances(room);
  return {
    id: room.id, name: room.name, currency: room.currency, invitationCode: room.invitationCode,
    status: room.status, expiresAt: room.expiresAt, closedAt: room.closedAt,
    writable: room.status === 'OPEN' && room.expiresAt > new Date(), me,
    total: room.expenses.reduce((sum, item) => sum + cents(item.amount), 0),
    participants: room.participants.map(({ guestTokenHash: _secret, ...participant }) => ({
      ...participant, balance: balance[participant.id],
    })),
    expenses: room.expenses,
    settlements: room.settlements,
  };
}

async function authorize(tx: Transaction, code: string, token: string, write: boolean) {
  const room = await tx.quickRoom.findUnique({ where: { invitationCode: code }, include: includeRoom });
  if (!room) throw new QuickRoomError('La sala no existe. Revisa el código.', 404);
  const participant = room.participants.find((p) => p.guestTokenHash === tokenHash(token));
  if (!participant) throw new QuickRoomError('Necesitas entrar a esta sala con tu sesión de invitado.', 401);
  if (write && (room.status !== 'OPEN' || room.expiresAt <= new Date())) {
    throw new QuickRoomError('La sala está cerrada o venció. Solo está disponible para consulta.', 409);
  }
  return { room, participant };
}

// Serializa cambios de una sala: evita repartir contra una lista que cambie a mitad de operación.
async function locked<T>(code: string, work: (tx: Transaction) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "QuickRoom" WHERE "invitationCode" = ${code} FOR UPDATE`;
    return work(tx);
  });
}

export async function createRoom(body: Body) {
  const name = text(body.name, 'Nombre de sala');
  const displayName = text(body.displayName, 'Tu nombre', 50);
  const token = randomBytes(32).toString('base64url');
  const room = await prisma.quickRoom.create({
    data: {
      name, invitationCode: randomBytes(8).toString('hex').toUpperCase(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      participants: { create: { displayName, role: 'OWNER', guestTokenHash: tokenHash(token) } },
    },
    include: includeRoom,
  });
  return { token, room: publicRoom(room, room.participants[0].id) };
}

export async function joinRoom(code: string, body: Body) {
  const displayName = text(body.displayName, 'Tu nombre', 50);
  return locked(code, async (tx) => {
    const room = await tx.quickRoom.findUnique({ where: { invitationCode: code }, include: includeRoom });
    if (!room) throw new QuickRoomError('La sala no existe.', 404);
    if (room.status !== 'OPEN' || room.expiresAt <= new Date()) throw new QuickRoomError('La sala está cerrada o venció.', 409);
    if (room.participants.length >= 50) throw new QuickRoomError('Esta sala ya tiene 50 participantes.', 409);
    const token = randomBytes(32).toString('base64url');
    const participant = await tx.quickRoomParticipant.create({
      data: { roomId: room.id, displayName, guestTokenHash: tokenHash(token) },
    });
    const updated = await tx.quickRoom.findUniqueOrThrow({ where: { id: room.id }, include: includeRoom });
    return { token, room: publicRoom(updated, participant.id) };
  });
}

export async function getRoom(code: string, token: string) {
  const { room, participant } = await authorize(prisma, code, token, false);
  return publicRoom(room, participant.id);
}

export async function mutateRoom(code: string, token: string, action: string, body: Body, itemId?: string) {
  return locked(code, async (tx) => {
    const { room, participant } = await authorize(tx, code, token, true);
    if (action === 'profile') {
      const optionalText = (v: unknown, label: string) => v === '' || v == null ? null : text(v, label, 100);
      const paymentMethod = optionalText(body.paymentMethod, 'Método de pago');
      const paymentReference = optionalText(body.paymentReference, 'Número o llave');
      if (Boolean(paymentMethod) !== Boolean(paymentReference)) throw new QuickRoomError('Indica el método y su número o llave, o deja ambos vacíos.');
      await tx.quickRoomParticipant.update({ where: { id: participant.id }, data: {
        displayName: text(body.displayName, 'Tu nombre', 50), paymentMethod, paymentReference,
        paymentHolder: optionalText(body.paymentHolder, 'Titular'),
      } });
    } else if (action === 'close') {
      if (participant.role !== 'OWNER') throw new QuickRoomError('Solo el organizador puede cerrar la sala.', 403);
      if (room.settlements.some((p) => p.status === 'REPORTED')) throw new QuickRoomError('Confirma o cancela los pagos pendientes antes de cerrar.');
      await tx.quickRoom.update({ where: { id: room.id }, data: { status: 'CLOSED', closedAt: new Date() } });
    } else if (['expense', 'editExpense', 'deleteExpense'].includes(action)) {
      if (action !== 'expense' && room.settlements.length) throw new QuickRoomError('Los gastos anteriores no pueden corregirse cuando ya hay pagos. Puedes seguir registrando gastos nuevos.', 409);
      const existing = itemId ? room.expenses.find((e) => e.id === itemId) : undefined;
      if (action !== 'expense') {
        if (!existing) throw new QuickRoomError('Gasto no encontrado.', 404);
        if (existing.createdByParticipantId !== participant.id && participant.role !== 'OWNER') throw new QuickRoomError('Solo puedes modificar tus gastos.', 403);
      }
      if (action === 'deleteExpense') {
        await tx.quickRoomExpense.delete({ where: { id: existing!.id } });
      } else {
        if (action === 'expense' && room.expenses.length >= 500) throw new QuickRoomError('Límite de 500 gastos por sala.');
        const amount = parseAmount(body.amount);
        const description = text(body.description, 'Detalle del gasto', 160);
        const payer = room.participants.find((p) => p.id === body.paidByParticipantId);
        if (!payer) throw new QuickRoomError('El pagador debe pertenecer a la sala.');
        if (!Array.isArray(body.participantIds) || !body.participantIds.length) throw new QuickRoomError('Selecciona al menos un participante.');
        const ids = [...new Set(body.participantIds)];
        if (ids.some((id) => typeof id !== 'string' || !room.participants.some((p) => p.id === id))) throw new QuickRoomError('Reparto inválido.');
        const sorted = room.participants.filter((p) => ids.includes(p.id)).sort((a, b) => a.id.localeCompare(b.id));
        const base = Math.floor(amount / sorted.length);
        const remainder = amount % sorted.length;
        const shares = sorted.map((p, index) => ({ participantId: p.id, amount: decimal(base + (index < remainder ? 1 : 0)) }));
        const data = { description, amount: decimal(amount), paidByParticipantId: payer.id };
        if (existing) {
          await tx.quickRoomExpenseShare.deleteMany({ where: { expenseId: existing.id } });
          await tx.quickRoomExpense.update({ where: { id: existing.id }, data: { ...data, shares: { create: shares } } });
        } else {
          await tx.quickRoomExpense.create({ data: { ...data, roomId: room.id, createdByParticipantId: participant.id, shares: { create: shares } } });
        }
      }
    } else if (action === 'payment') {
      const receiver = room.participants.find((p) => p.id === body.toParticipantId);
      if (!receiver || receiver.id === participant.id) throw new QuickRoomError('Selecciona otro participante como destinatario.');
      const amount = parseAmount(body.amount);
      const balance = balances(room);
      const outgoing = room.settlements.filter((p) => p.status === 'REPORTED' && p.fromParticipantId === participant.id).reduce((s, p) => s + cents(p.amount), 0);
      const incoming = room.settlements.filter((p) => p.status === 'REPORTED' && p.toParticipantId === receiver.id).reduce((s, p) => s + cents(p.amount), 0);
      if (amount > -balance[participant.id] - outgoing || amount > balance[receiver.id] - incoming) {
        throw new QuickRoomError('El pago supera tu deuda pendiente o lo que debe recibir esa persona.');
      }
      await tx.quickRoomSettlement.create({ data: { roomId: room.id, fromParticipantId: participant.id, toParticipantId: receiver.id, amount: decimal(amount) } });
    } else if (action === 'confirm' || action === 'cancel') {
      const payment = room.settlements.find((p) => p.id === itemId);
      if (!payment) throw new QuickRoomError('Pago no encontrado.', 404);
      if (payment.status !== 'REPORTED') throw new QuickRoomError('Este pago ya fue confirmado.', 409);
      if (action === 'confirm') {
        if (payment.toParticipantId !== participant.id) throw new QuickRoomError('Solo el destinatario puede confirmar la recepción.', 403);
        await tx.quickRoomSettlement.update({ where: { id: payment.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
      } else {
        if (![payment.fromParticipantId, payment.toParticipantId].includes(participant.id)) throw new QuickRoomError('No puedes cancelar este pago.', 403);
        await tx.quickRoomSettlement.delete({ where: { id: payment.id } });
      }
    } else throw new QuickRoomError('Operación desconocida.');
    const updated = await tx.quickRoom.findUniqueOrThrow({ where: { id: room.id }, include: includeRoom });
    return publicRoom(updated, participant.id);
  });
}
