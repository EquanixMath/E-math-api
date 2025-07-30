   // @ts-nocheck
   import app from '../src/app.js';
   import { VercelRequest, VercelResponse } from '@vercel/node';

   export default async function handler(req: VercelRequest, res: VercelResponse) {
     // Vercel จะส่ง req/res ที่เป็น Node.js http objects
     // ใช้ Express app เป็น middleware handler
     app(req, res);
   }