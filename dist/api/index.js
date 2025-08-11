// @ts-nocheck
import app from '../src/app.js';
import connectDB from '../src/config/db.js';
export default async function handler(req, res) {
    try {
        // เชื่อมต่อ MongoDB ก่อนทุกครั้ง (จะ cache connection อัตโนมัติ)
        await connectDB();
        // ใช้ Express app เป็น middleware handler
        app(req, res);
    }
    catch (error) {
        console.error('Database connection failed:', error);
        res.status(500).json({ error: 'Database connection failed' });
    }
}
