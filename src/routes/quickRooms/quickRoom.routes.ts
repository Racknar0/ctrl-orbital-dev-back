import { Router, type RequestHandler } from 'express';
import { roomController } from '../../controllers/quickRooms/quickRoom.controller.js';

const router = Router();
const attempts = new Map<string, { count: number; until: number }>();
const limit: RequestHandler = (request, response, next) => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = request.ip ?? 'unknown';
  const current = attempts.get(key) ?? { count: 0, until: now + 60_000 };
  current.count += 1;
  attempts.set(key, current);
  if (current.count > 20) { response.status(429).json({ message: 'Demasiados intentos. Espera un minuto.' }); return; }
  next();
};
router.post('/', limit, roomController('create'));
router.post('/:code/join', limit, roomController('join'));
router.get('/:code', roomController('get'));
router.patch('/:code/me', roomController('profile'));
router.post('/:code/close', roomController('close'));
router.post('/:code/expenses', roomController('expense'));
router.patch('/:code/expenses/:id', roomController('editExpense'));
router.delete('/:code/expenses/:id', roomController('deleteExpense'));
router.post('/:code/payments', roomController('payment'));
router.post('/:code/payments/:id/confirm', roomController('confirm'));
router.delete('/:code/payments/:id', roomController('cancel'));
export default router;
