import { Router } from 'express';
import { currentUserController, loginController, registerController } from '../../controllers/auth/auth.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', registerController);
router.post('/login', loginController);
router.get('/me', authMiddleware, currentUserController);

export default router;
