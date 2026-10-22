import type { RequestHandler } from 'express';
import { createRoom, getRoom, joinRoom, mutateRoom, QuickRoomError } from '../../services/quickRooms/quickRoom.service.js';

export const roomController = (action: string): RequestHandler => async (request, response, next) => {
  try {
    const code = String(request.params.code ?? '').trim().toUpperCase();
    const token = request.get('X-Room-Token') ?? '';
    const body = request.body && typeof request.body === 'object' && !Array.isArray(request.body) ? request.body : {};
    response.set('Cache-Control', 'no-store');
    if (action === 'create') response.status(201).json(await createRoom(body));
    else if (action === 'join') response.status(201).json(await joinRoom(code, body));
    else if (action === 'get') response.json(await getRoom(code, token));
    else response.json(await mutateRoom(code, token, action, body, request.params.id as string | undefined));
  } catch (error) {
    if (error instanceof QuickRoomError) response.status(error.status).json({ message: error.message });
    else next(error);
  }
};
