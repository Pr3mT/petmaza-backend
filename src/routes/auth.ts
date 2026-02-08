import express from 'express';
import { register, login, logout, getMe, updateProfile } from '../controllers/authController';
import { verifyToken } from '../middlewares/auth';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);

export default router;

