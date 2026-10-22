import cors from 'cors';
import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import authRoutes from './routes/auth/auth.routes.js';
import userRoutes from './routes/users/user.routes.js';

const app = express();

const allowedOrigins = new Set([process.env.FRONTEND_URL ?? 'http://localhost:3000']);

if (process.env.NODE_ENV !== 'production') {
  for (const port of [3000, 3001]) {
    allowedOrigins.add(`http://localhost:${port}`);
    allowedOrigins.add(`http://127.0.0.1:${port}`);
  }
}

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
}));
app.use(express.json());
app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
