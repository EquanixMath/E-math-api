# E-Math API

API สำหรับระบบ Math Bingo Generator

## การติดตั้งและรัน API บน Localhost:3001

### 1. ติดตั้ง Dependencies

```bash
# ติดตั้ง dependencies ทั้งหมด
npm install
```

### 2. สร้างไฟล์ Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ `E-math-api/` และเพิ่มค่าต่อไปนี้:

```env
PORT=3001
JWT_SECRET=your_jwt_secret_key_here
MONGODB_URI=your_mongodb_connection_string
ALLOWED_USERNAME=your_allowed_username
```

**หมายเหตุ:**
- `PORT=3001` - กำหนดให้ API รันบน port 3001
- `JWT_SECRET` - ใช้สำหรับการเข้ารหัส JWT tokens
- `MONGODB_URI` - connection string ของ MongoDB database
- `ALLOWED_USERNAME` - username ที่อนุญาตให้เข้าสู่ระบบ

### 3. รัน API

#### วิธีที่ 1: รันด้วย ts-node (สำหรับ Development)

```bash
# รันด้วย ts-node โดยตรง
npx ts-node src/index.ts
```

#### วิธีที่ 2: Build และรัน (สำหรับ Production)

```bash
# Build TypeScript เป็น JavaScript
npm run build

# รันไฟล์ที่ build แล้ว
node dist/index.js
```

#### วิธีที่ 3: เพิ่ม Script ใน package.json

เพิ่ม script ต่อไปนี้ใน `package.json`:

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc"
  }
}
```

จากนั้นรันด้วย:

```bash
# สำหรับ development
npm run dev

# สำหรับ production (ต้อง build ก่อน)
npm run build
npm start
```

### 4. ตรวจสอบการทำงาน

เมื่อรันสำเร็จ จะเห็นข้อความ:
```
Server running on port 3001
```

### 5. ทดสอบ API

API จะทำงานที่ `http://localhost:3001`

#### Endpoints ที่มี:

- `POST /auth/login` - เข้าสู่ระบบ
- `POST /auth/register` - ลงทะเบียน (ถ้ามี)
- `GET /auth/profile` - ดูข้อมูลผู้ใช้ (ต้องมี token)

### 6. การแก้ไขปัญหา

#### ปัญหาที่พบบ่อย:

1. **Port ถูกใช้งานแล้ว**
   ```bash
   # ตรวจสอบ process ที่ใช้ port 3001
   lsof -i :3001
   
   # Kill process (ถ้าจำเป็น)
   kill -9 <PID>
   ```

2. **MongoDB ไม่เชื่อมต่อ**
   - ตรวจสอบ `MONGODB_URI` ในไฟล์ `.env`
   - ตรวจสอบการเชื่อมต่อ internet

3. **TypeScript compilation errors**
   ```bash
   # ตรวจสอบ TypeScript errors
   npx tsc --noEmit
   ```

### 7. การพัฒนา

สำหรับการพัฒนา แนะนำให้ใช้:

```bash
# รันในโหมด development พร้อม auto-reload
npm run dev
```

### 8. การ Deploy

สำหรับการ deploy บน Vercel:

```bash
# Build project
npm run build

# Deploy (ถ้าใช้ Vercel CLI)
vercel
```

---

**หมายเหตุ:** ตรวจสอบให้แน่ใจว่า MongoDB database พร้อมใช้งานและ connection string ถูกต้องก่อนรัน API
