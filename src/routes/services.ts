import express from 'express';
import {
  createBirdDNAService,
  getMyServiceRequests,
  getServiceRequest,
} from '../controllers/serviceController';
import { verifyToken } from '../middlewares/auth';

const router = express.Router();

router.post('/bird-dna', verifyToken, createBirdDNAService);
router.get('/my', verifyToken, getMyServiceRequests);
router.get('/:id', verifyToken, getServiceRequest);

export default router;

