import { Router } from 'express';
import {
  getConfigTestResults,
  saveConfigTestResults,
  clearConfigTestResults,
} from '../controllers/configTest.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/',       authMiddleware, requireAdmin, getConfigTestResults);
router.post('/batch', authMiddleware, requireAdmin, saveConfigTestResults);
router.delete('/',    authMiddleware, requireAdmin, clearConfigTestResults);

export default router;
