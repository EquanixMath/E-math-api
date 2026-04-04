import { Router } from 'express';
import { listTileSets, createTileSet, updateTileSet, deleteTileSet } from '../controllers/setting.js';
import { authMiddleware } from '../middleware/auth.js';

// Middleware: attach from your auth middleware (e.g. requireAuth)
// Import and use your existing auth middleware here, e.g.:
// import { requireAuth } from './auth-control';

const router = Router();

// All routes require authentication (apply your auth middleware)
router.get('/tile-sets', authMiddleware, listTileSets);
router.post('/tile-sets', authMiddleware, createTileSet);
router.patch('/tile-sets/:id', authMiddleware, updateTileSet);
router.delete('/tile-sets/:id', authMiddleware, deleteTileSet);
export default router;
