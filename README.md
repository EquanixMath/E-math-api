# E-math-api Auth System

## Setup

1. ติดตั้ง dependencies

```bash
npm install
```

2. สร้างไฟล์ `.env` ใน root directory แล้วใส่ค่าตัวอย่างนี้:

```
MONGODB_URI=mongodb://localhost:27017/emath
JWT_SECRET=your_jwt_secret_here
ALLOWED_USERNAME=your_username_here
PORT=3000
```

3. รันเซิร์ฟเวอร์

```bash
npm run dev
```

## Endpoints

### POST /auth/register
- สำหรับสมัคร user (อนุญาตเฉพาะ username ที่กำหนดใน ALLOWED_USERNAME)
- Body: `{ "username": "your_username_here", "password": "your_password" }`

### POST /auth/login
- สำหรับ login
- Body: `{ "username": "your_username_here", "password": "your_password" }`
- Response: `{ "token": "..." }`

### GET /auth/profile
- ต้องแนบ Authorization header: `Bearer <token>`
- คืนข้อมูล user

## Security
- Password hash ด้วย bcrypt
- JWT เก็บ secret ใน .env
- Register ได้เฉพาะ username ที่กำหนด

```
