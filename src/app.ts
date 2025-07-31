import express from 'express';
import cors from 'cors';
import './config/env.js';
import authRouter from './router/auth.js';

const app = express();
app.use(cors({
    origin: ['http://localhost:3000','https://ds-bingo-pmprwdascver-2025-qjpkbzy4x-thitithats-projects.vercel.app'], 
    credentials: true,            
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization'],    
  }));
app.use(express.json());

app.use('/auth', authRouter);

export default app;