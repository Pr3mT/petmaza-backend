import express from 'express';
import { recordVisit, getVisitorStats } from '../controllers/visitorController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// Public: daily visit ping (in-memory increment only, no DB work per request)
router.post('/', recordVisit);

// Admin dashboard: day-wise visitor counts
router.get('/stats', verifyToken, checkRole('admin', 'sub_admin'), getVisitorStats);

export default router;
