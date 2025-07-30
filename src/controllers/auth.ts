import type { Request, Response } from 'express';
import User from '../models/User.js';
import BlacklistedToken from '../models/BlacklistedToken.js';
import { JWT_SECRET } from '../config/env.js';
import type { AuthRequest } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export const register = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) {
    return res.status(400).json({ message: 'User already exists' });
  }
  const user = new User({ username, password });
  await user.save();
  return res.status(201).json({ message: 'User registered' });
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  return res.json({ token });
};

export const profile = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const user = await User.findById(userId).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json(user);
};

export const logout = async (req: AuthRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    await BlacklistedToken.create({ token });
    console.log('Token blacklisted:', token);
  } catch (err) {
    console.error('Blacklist error:', err);
  }
  return res.json({ message: 'Logged out successfully' });
}; 