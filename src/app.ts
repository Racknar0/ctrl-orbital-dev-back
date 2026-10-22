import cors from 'cors';
import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import authRoutes from './routes/auth/auth.routes.js';
import userRoutes from './routes/users/user.routes.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());
app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
