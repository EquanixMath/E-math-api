import { Router } from 'express';
import { exportPdf, exportDocx } from '../controllers/export.js';

const router = Router();

// Body is already parsed by the global express.json({ limit: '2mb' }) in app.ts.
// Do NOT add another express.json() here — body can only be parsed once.

router.post('/pdf', exportPdf);
router.post('/docx', exportDocx);

export default router;
