import { Router } from 'express';
import { createUserController, deleteUserController, listUsersController, updateUserController } from '../../controllers/users/user.controller.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';
import { requirePlatformAdmin } from '../../middlewares/requirePlatformAdmin.js';

const router = Router();

router.use(authMiddleware, requirePlatformAdmin);
router.get('/', listUsersController);
router.post('/', createUserController);
router.patch('/:id', updateUserController);
router.delete('/:id', deleteUserController);

export default router;
