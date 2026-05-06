import express from 'express';
import cors from 'cors';
import './config/env.js';

import authRouter from './router/auth.js';
import assignmentRouter from './router/assignment.js';
import settingsRouter from './router/setting.js';
import exportRouter from './router/export.js';
import configTestRouter from './router/configTest.js';

const app = express();

// CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://ds-bingo-pmprwdascver-2025.vercel.app',
    'https://ds-bingo-pmprwdascver-2025-jet.vercel.app',
    'http://192.168.169.7:3000',
    'http://10.242.54.7:3000',
    'http://10.156.11.7:3000',
    'http://192.168.1.39:3000'
  ],
  credentials: true,
}));

// Body parser
// 2mb covers the largest expected payload (~600KB for 1000 trimmed puzzles)
// while still rejecting clearly abusive requests.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ───── Routes ─────
app.use('/auth', authRouter);
app.use('/assignments', assignmentRouter);
app.use('/api/export', exportRouter);
app.use('/config-tests', configTestRouter);

// 🔥 ตัวที่คุณขาด
app.use('/', settingsRouter);
// หรือถ้าอยาก clean:
// app.use('/settings', settingsRouter);

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ message: 'Payload too large. Maximum request size is 2MB.' });
    return;
  }
  console.error('Error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;