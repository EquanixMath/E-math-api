# API Endpoints Documentation

## Base URL
```
http://localhost:3001
```

## Authentication
API ใช้ JWT Token สำหรับการยืนยันตัวตน

---

## 📋 Public Endpoints (ไม่ต้อง Login)

### 1. Health Check
**GET** `/auth/health`
- ตรวจสอบสถานะของระบบ Auth
- ไม่ต้องมี Authorization

**Postman:**
```
GET http://localhost:3001/auth/health
```

### 2. Register Student
**POST** `/auth/register/student`
- สมัครสมาชิกสำหรับ Student

**Body:**
```json
{
  "username": "student1",
  "password": "password123",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "nickname": "ชาย",
  "school": "โรงเรียนตัวอย่าง",
  "purpose": "เรียนคณิตศาสตร์"
}
```

**Postman:**
```
POST http://localhost:3001/auth/register/student
Content-Type: application/json

{
  "username": "student1",
  "password": "password123",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "nickname": "ชาย",
  "school": "โรงเรียนตัวอย่าง",
  "purpose": "เรียนคณิตศาสตร์"
}
```

### 3. Register Admin
**POST** `/auth/register/admin`
- สมัครสมาชิกสำหรับ Admin (เฉพาะ username ที่กำหนดใน ALLOWED_USERNAME)

**Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Postman:**
```
POST http://localhost:3001/auth/register/admin
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### 4. Login
**POST** `/auth/login`
- เข้าสู่ระบบ

**Body:**
```json
{
  "username": "student1",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "username": "student1",
    "role": "student",
    "status": "pending"
  }
}
```

**Postman:**
```
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "username": "student1",
  "password": "password123"
}
```

---

## 🔐 Protected Endpoints (ต้องมี Token)

### 5. Get Profile
**GET** `/auth/profile`
- ดูข้อมูลโปรไฟล์ตนเอง

**Headers:**
```
Authorization: Bearer <token>
```

**Postman:**
```
GET http://localhost:3001/auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. Logout
**POST** `/auth/logout`
- ออกจากระบบ (เพิ่ม token เข้า blacklist)

**Headers:**
```
Authorization: Bearer <token>
```

**Postman:**
```
POST http://localhost:3001/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 👨‍💼 Admin Only Endpoints

### 7. Get Pending Students
**GET** `/auth/admin/students/pending`
- ดูรายการ Student ที่รอการอนุมัติ

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Postman:**
```
GET http://localhost:3001/auth/admin/students/pending
Authorization: Bearer <admin_token>
```

### 8. Get All Students
**GET** `/auth/admin/students`
- ดูรายการ Student ทั้งหมด

**Query Parameters:**
- `status`: `pending` | `approved` | `rejected`
- `page`: `1` (default)
- `limit`: `10` (default)

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Postman:**
```
GET http://localhost:3001/auth/admin/students?status=pending&page=1&limit=10
Authorization: Bearer <admin_token>
```

### 9. Approve Student
**PUT** `/auth/admin/students/:studentId/approve`
- อนุมัติ Student

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Postman:**
```
PUT http://localhost:3001/auth/admin/students/64f1234567890abcdef12345/approve
Authorization: Bearer <admin_token>
```

### 10. Reject Student
**PUT** `/auth/admin/students/:studentId/reject`
- ปฏิเสธ Student

**Body:**
```json
{
  "reason": "ข้อมูลไม่ครบถ้วน"
}
```

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Postman:**
```
PUT http://localhost:3001/auth/admin/students/64f1234567890abcdef12345/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "ข้อมูลไม่ครบถ้วน"
}
```

---

## 👨‍🎓 Student Only Endpoints

### 11. Student Dashboard
**GET** `/auth/student/dashboard`
- Dashboard สำหรับ Student ที่ได้รับการอนุมัติ

**Headers:**
```
Authorization: Bearer <student_token>
```

**Postman:**
```
GET http://localhost:3001/auth/student/dashboard
Authorization: Bearer <student_token>
```

---

## 🔄 Mixed Access Endpoints

### 12. Main Dashboard
**GET** `/auth/dashboard`
- Dashboard หลักสำหรับ User ที่ได้รับอนุมัติ (Admin + Approved Student)

**Headers:**
```
Authorization: Bearer <token>
```

**Postman:**
```
GET http://localhost:3001/auth/dashboard
Authorization: Bearer <token>
```

---

## 🧪 การทดสอบใน Postman

### ขั้นตอนการทดสอบ:

1. **สร้าง Collection ใหม่**
   - ตั้งชื่อ: `E-Math API`

2. **สร้าง Environment Variables**
   - `base_url`: `http://localhost:3001`
   - `token`: (จะเก็บ token หลัง login)

3. **ทดสอบตามลำดับ:**

#### Step 1: Health Check
```
GET {{base_url}}/auth/health
```

#### Step 2: Register Student
```
POST {{base_url}}/auth/register/student
Content-Type: application/json

{
  "username": "teststudent",
  "password": "password123",
  "firstName": "ทดสอบ",
  "lastName": "นักเรียน",
  "nickname": "ทดสอบ",
  "school": "โรงเรียนทดสอบ",
  "purpose": "ทดสอบระบบ"
}
```

#### Step 3: Login
```
POST {{base_url}}/auth/login
Content-Type: application/json

{
  "username": "teststudent",
  "password": "password123"
}
```

**ตั้งค่า Environment Variable:**
- หลัง login สำเร็จ ให้ copy token จาก response
- ไปที่ Environment → `token` → paste token

#### Step 4: Test Protected Endpoints
```
GET {{base_url}}/auth/profile
Authorization: Bearer {{token}}
```

### ตัวอย่าง Response Codes:

- `200` - สำเร็จ
- `201` - สร้างใหม่สำเร็จ
- `400` - ข้อมูลไม่ถูกต้อง
- `401` - ไม่มีสิทธิ์ (ไม่มี token หรือ token หมดอายุ)
- `403` - ไม่มีสิทธิ์ (role ไม่ถูกต้อง)
- `404` - ไม่พบข้อมูล
- `500` - ข้อผิดพลาดภายในเซิร์ฟเวอร์

### Tips สำหรับ Postman:

1. **ใช้ Environment Variables** เพื่อไม่ต้องพิมพ์ URL ซ้ำ
2. **ใช้ Tests Tab** เพื่อ auto-save token:
   ```javascript
   if (pm.response.code === 200) {
       pm.environment.set("token", pm.response.json().token);
   }
   ```
3. **ใช้ Pre-request Script** เพื่อ auto-set headers
4. **สร้าง Folder** แยกตามประเภท endpoints

---

## 🔧 การแก้ไขปัญหา

### ปัญหาที่พบบ่อย:

1. **CORS Error**
   - ตรวจสอบว่า API รันที่ port 3001
   - ตรวจสอบ CORS configuration

2. **Token Expired**
   - Login ใหม่เพื่อได้ token ใหม่

3. **Permission Denied**
   - ตรวจสอบ role ของ user
   - ตรวจสอบ status ของ student (ต้องเป็น approved)

4. **Database Connection**
   - ตรวจสอบ MongoDB connection
   - ตรวจสอบ environment variables 