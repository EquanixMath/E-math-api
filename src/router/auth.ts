import express from 'express';
const { Router } = express;
import { register, login, profile, logout } from '../controllers/auth.ts';
import { authMiddleware } from '../middleware/auth.ts';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, profile);
router.post('/logout', authMiddleware, logout);

export default router; 