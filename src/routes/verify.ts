import express from 'express';
import { renderDnaVerification } from '../controllers/serviceController';

// Public QR-landing pages. Mounted at /verify rather than under /api because
// these URLs are printed on physical cards and get read by humans in a browser
// address bar — they should look like a page, not an endpoint.
const router = express.Router();

router.get('/dna', renderDnaVerification);

export default router;
