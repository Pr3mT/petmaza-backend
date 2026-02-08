import express from 'express';
import { debugProducts } from '../controllers/debugController';
import { verifyToken } from '../middlewares/auth';
import User from '../models/User';

const router = express.Router();

router.get('/products', debugProducts);

router.get('/me', verifyToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id);
    res.json({ 
      success: true,
      user: {
        id: user?._id,
        email: user?.email,
        name: user?.name,
        role: user?.role,
        type: user?.type
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
