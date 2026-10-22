import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import app from '../dist/src/app.js';
import { prisma } from '../dist/src/utils/prisma.js';

// Usa solo datos creados por esta suite, nunca resetea tablas ni toca usuarios.
const database = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/app_gastos') {
  throw new Error('Esta suite solo admite la base local app_gastos.');
}

test('Salas rápidas: integración HTTP y PostgreSQL local', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/quick-rooms`;
  const rooms = [];
  async function api(method, path = '', token = '', body, expected = 200) {
    const response = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', 'X-Room-Token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${data.message || response.status}`);
    return data;
  }
  async function fixture(member = true) {
    const owner = await api('POST', '', '', { name: 'Suite API salas rápidas', displayName: 'Ana' }, 201);
    rooms.push(owner.room.id);
    const code = owner.room.invitationCode;
    const guest = member ? await api('POST', `/${code}/join`, '', { displayName: 'Bruno' }, 201) : null;
    return { owner, guest, code, ownerId: owner.room.me, guestId: guest?.room.me };
  }
  const expensePayload = (f, amount = '100.01') => ({
    description: 'Compra compartida', amount, paidByParticipantId: f.ownerId,
    participantIds: [f.ownerId, f.guestId],
  });
  try {
    await t.test('crear, validar campos y proteger datos de invitados', async () => {
      await api('POST', '', '', { name: '', displayName: 'Ana' }, 400);
      const f = await fixture(false);
      assert.equal(f.owner.room.currency, 'COP');
      assert.equal(f.owner.room.participants[0].role, 'OWNER');
      const lifetime = new Date(f.owner.room.expiresAt).getTime() - Date.now();
      assert.ok(lifetime > 29 * 86400000 && lifetime <= 30 * 86400000);
      await api('GET', `/${f.code}`, '', undefined, 401);
      const view = await api('GET', `/${f.code}`, f.owner.token);
      assert.equal(JSON.stringify(view).includes('guestTokenHash'), false);
      assert.equal('token' in view, false);
    });
    await t.test('identidad separada del alias y acceso limitado por sala', async () => {
      const f = await fixture(false);
      const guest = await api('POST', `/${f.code}/join`, '', { displayName: 'Ana' }, 201);
      assert.notEqual(guest.room.me, f.ownerId);
      const other = await fixture(false);
      await api('GET', `/${other.code}`, f.owner.token, undefined, 401);
      await api('PATCH', `/${f.code}/me`, guest.token, {
        displayName: 'Invitado', paymentMethod: 'Nequi', paymentReference: '3000000000', paymentHolder: 'Ejemplo',
      });
      const view = await api('GET', `/${f.code}`, f.owner.token);
      assert.equal(view.participants.find((p) => p.id === guest.room.me).paymentReference, '3000000000');
      await api('PATCH', `/${f.code}/me`, guest.token, { displayName: 'Invitado', paymentMethod: 'Nequi' }, 400);
    });
    await t.test('reparto exacto, ingreso posterior e importes inválidos', async () => {
      const f = await fixture();
      const created = await api('POST', `/${f.code}/expenses`, f.owner.token, expensePayload(f));
      const shares = created.expenses[0].shares;
      assert.equal(shares.reduce((sum, s) => sum + Math.round(Number(s.amount) * 100), 0), 10001);
      assert.equal(created.participants.reduce((sum, p) => sum + p.balance, 0), 0);
      const late = await api('POST', `/${f.code}/join`, '', { displayName: 'Carla' }, 201);
      assert.equal(late.room.expenses[0].shares.length, 2);
      assert.equal(late.room.participants.find((p) => p.id === late.room.me).balance, 0);
      for (const amount of ['0', '-1', '1.001', '1e3', '999999999999999999999']) {
        await api('POST', `/${f.code}/expenses`, f.owner.token, expensePayload(f, amount), 400);
      }
      await api('POST', `/${f.code}/expenses`, f.owner.token, { ...expensePayload(f), participantIds: ['ajeno'] }, 400);
      await api('POST', `/${f.code}/expenses`, f.owner.token, { ...expensePayload(f), paidByParticipantId: 'ajeno' }, 400);
    });
    await t.test('corregir y eliminar con permisos de autor u organizador', async () => {
      const f = await fixture();
      const created = await api('POST', `/${f.code}/expenses`, f.owner.token, expensePayload(f));
      const id = created.expenses[0].id;
      await api('PATCH', `/${f.code}/expenses/${id}`, f.guest.token, expensePayload(f, '40'), 403);
      const edited = await api('PATCH', `/${f.code}/expenses/${id}`, f.owner.token, expensePayload(f, '40'));
      assert.equal(edited.total, 4000);
      const deleted = await api('DELETE', `/${f.code}/expenses/${id}`, f.owner.token);
      assert.equal(deleted.total, 0);
      assert.equal(deleted.expenses.length, 0);
    });
    await t.test('pagos concurrentes, confirmación y nuevos gastos después de saldar', async () => {
      const f = await fixture();
      const initial = await api('POST', `/${f.code}/expenses`, f.owner.token, expensePayload(f, '100'));
      await api('POST', `/${f.code}/payments`, f.guest.token, { toParticipantId: f.ownerId, amount: '999' }, 400);
      const body = { toParticipantId: f.ownerId, amount: '50' };
      const reports = await Promise.all([1, 2].map(() => fetch(`${base}/${f.code}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Room-Token': f.guest.token }, body: JSON.stringify(body),
      })));
      assert.deepEqual(reports.map((r) => r.status).sort(), [200, 400]);
      const reported = await api('GET', `/${f.code}`, f.owner.token);
      const id = reported.settlements[0].id;
      assert.equal(reported.participants.find((p) => p.id === f.guestId).balance, -5000);
      await api('POST', `/${f.code}/payments/${id}/confirm`, f.guest.token, {}, 403);
      const confirmed = await api('POST', `/${f.code}/payments/${id}/confirm`, f.owner.token, {});
      assert.ok(confirmed.participants.every((p) => p.balance === 0));
      await api('POST', `/${f.code}/payments/${id}/confirm`, f.owner.token, {}, 409);
      await api('DELETE', `/${f.code}/expenses/${initial.expenses[0].id}`, f.owner.token, undefined, 409);
      const next = await api('POST', `/${f.code}/expenses`, f.owner.token, expensePayload(f, '20'));
      assert.equal(next.participants.find((p) => p.id === f.guestId).balance, -1000);
    });
    await t.test('cancelación de reportes, cierre y permisos del organizador', async () => {
      const f = await fixture();
      await api('POST', `/${f.code}/expenses`, f.owner.token, expensePayload(f, '100'));
      const reported = await api('POST', `/${f.code}/payments`, f.guest.token, { toParticipantId: f.ownerId, amount: '10' });
      await api('POST', `/${f.code}/close`, f.owner.token, {}, 400);
      await api('DELETE', `/${f.code}/payments/${reported.settlements[0].id}`, f.guest.token);
      await api('POST', `/${f.code}/close`, f.guest.token, {}, 403);
      const closed = await api('POST', `/${f.code}/close`, f.owner.token, {});
      assert.equal(closed.writable, false);
      await api('POST', `/${f.code}/join`, '', { displayName: 'Tarde' }, 409);
      await api('POST', `/${f.code}/expenses`, f.owner.token, expensePayload(f), 409);
      assert.equal((await api('GET', `/${f.code}`, f.owner.token)).status, 'CLOSED');
    });
    await t.test('vencimiento y CORS del frontend local', async () => {
      const f = await fixture(false);
      await prisma.quickRoom.update({ where: { id: f.owner.room.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await api('GET', `/${f.code}`, f.owner.token)).writable, false);
      await api('PATCH', `/${f.code}/me`, f.owner.token, { displayName: 'Cambio' }, 409);
      const response = await fetch(base, { method: 'OPTIONS', headers: { Origin: 'http://localhost:3001', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-room-token,content-type' } });
      assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3001');
      assert.match(response.headers.get('access-control-allow-headers'), /x-room-token/i);
    });
    await t.test('límite de intentos de acceso', async () => {
      let limited = false;
      for (let i = 0; i < 21; i += 1) {
        const r = await fetch(`${base}/NOEXISTE/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'Prueba' }) });
        if (r.status === 429) { limited = true; break; }
      }
      assert.equal(limited, true);
    });
  } finally {
    for (const roomId of rooms) await prisma.$transaction(async (tx) => {
      await tx.quickRoomSettlement.deleteMany({ where: { roomId } });
      await tx.quickRoomExpense.deleteMany({ where: { roomId } });
      await tx.quickRoomParticipant.deleteMany({ where: { roomId } });
      await tx.quickRoom.delete({ where: { id: roomId } });
    });
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }
});
