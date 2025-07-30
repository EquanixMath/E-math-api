import type { Request, Response, NextFunction } from 'express';
import { JWT_SECRET } from '../config/env.js';
import BlacklistedToken from '../models/BlacklistedToken.js';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  // Check blacklist
  console.log('🔍 Checking blacklist for token:', token.substring(0, 20) + '...');
  const blacklisted = await BlacklistedToken.findOne({ token });
  console.log('🔍 Blacklist result:', blacklisted ? 'FOUND (REVOKED)' : 'NOT FOUND (OK)');
  if (blacklisted) {
    console.log('❌ Token is blacklisted, rejecting request');
    return res.status(401).json({ message: 'Token has been revoked' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}; 