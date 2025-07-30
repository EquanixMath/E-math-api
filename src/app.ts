import express from 'express';
import cors from 'cors';
import connectDB from './config/db.ts';
import './config/env.ts';
import authRouter from './router/auth.ts';

const app = express();
app.use(cors({
    origin: 'http://localhost:3000', 
    credentials: true,            
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization'],    
  }));
app.use(express.json());

app.use('/auth', authRouter);

// Connect to database
connectDB().catch(console.error);

export default app;