import express from 'express';
import { getWallet, getVendorEarnings } from '../controllers/walletController';
import { verifyToken, checkRole } from '../middlewares/auth';

const router = express.Router();

// All routes require vendor authentication
router.use(verifyToken);
router.use(checkRole('vendor'));

router.get('/', getWallet);
router.get('/earnings', getVendorEarnings);

export default router;

