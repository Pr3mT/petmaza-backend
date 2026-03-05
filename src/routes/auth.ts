import express from 'express';
import { register, login, logout, getMe, updateProfile, sendVerificationEmailController, sendVerificationSuccessController } from '../controllers/authController';
import { verifyToken } from '../middlewares/auth';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/send-verification-email', sendVerificationEmailController);
router.post('/send-verification-success', sendVerificationSuccessController);
router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);

export default router;

