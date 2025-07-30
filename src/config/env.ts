import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
export const MONGODB_URI = process.env.MONGODB_URI || '';
export const ALLOWED_USERNAME = process.env.ALLOWED_USERNAME || ''; 