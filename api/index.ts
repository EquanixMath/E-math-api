   // @ts-nocheck
   import app from '../src/app.js';

   export default function handler(req, res) {
     // Vercel จะส่ง req/res ที่เป็น Node.js http objects
     // ใช้ Express app เป็น middleware handler
     app(req, res);
   }