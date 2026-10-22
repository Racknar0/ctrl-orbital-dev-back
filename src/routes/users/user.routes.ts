import { Router } from 'express';
import { listUsersController, updateUserController } from '../../controllers/users/user.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePlatformAdmin } from '../../middlewares/requirePlatformAdmin.js';

const router = Router();

router.use(authMiddleware, requirePlatformAdmin);
router.get('/', listUsersController);
router.patch('/:id', updateUserController);

export default router;
