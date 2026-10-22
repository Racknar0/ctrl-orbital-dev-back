import { Router } from 'express';
import {
  currentUserController,
  forgotPasswordController,
  loginController,
  registerController,
  resetPasswordController,
  verifyEmailController,
} from '../../controllers/auth/auth.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', registerController);
router.post('/login', loginController);
router.post('/verify-email', verifyEmailController);
router.post('/forgot-password', forgotPasswordController);
router.post('/reset-password', resetPasswordController);
router.get('/me', authMiddleware, currentUserController);

export default router;
