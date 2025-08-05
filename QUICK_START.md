# Quick Start Guide - รัน API บน Localhost:3001

## ขั้นตอนด่วน (5 นาที)

### 1. ติดตั้ง Dependencies
```bash
cd E-math-api
npm install
```

### 2. สร้างไฟล์ .env
สร้างไฟล์ `.env` ในโฟลเดอร์ `E-math-api/`:

```env
PORT=3001
JWT_SECRET=my_secret_key_123
MONGODB_URI=mongodb://localhost:27017/emath
ALLOWED_USERNAME=admin
```

### 3. รัน API
```bash
npm run dev
```

### 4. ตรวจสอบ
เปิดเบราว์เซอร์ไปที่ `http://localhost:3001`

ควรเห็นข้อความ: `Server running on port 3001`

## การทดสอบ API

### ทดสอบด้วย curl:

```bash
# ทดสอบ login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

## ปัญหาที่พบบ่อย

### Port 3001 ถูกใช้งานแล้ว
```bash
# ตรวจสอบ process
lsof -i :3001

# Kill process
kill -9 <PID>
```

### MongoDB ไม่เชื่อมต่อ
- ตรวจสอบว่า MongoDB ทำงานอยู่
- หรือใช้ MongoDB Atlas (cloud)

### TypeScript errors
```bash
# ตรวจสอบ errors
npx tsc --noEmit
```

## Development Tips

- ใช้ `npm run dev` สำหรับการพัฒนา
- ใช้ `npm run build && npm start` สำหรับ production
- ไฟล์ `.env` ไม่ควร commit ขึ้น git 