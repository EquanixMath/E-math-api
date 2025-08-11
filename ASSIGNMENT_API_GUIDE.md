# Assignment Management API Guide

## Overview

A complete backend API for assignment management system using Node.js, Express, and MongoDB. The system allows admins to create assignments, assign them to students, track progress, and manage student submissions.

## System Architecture

### Models
- **User**: Extended existing model with student/admin roles
- **Assignment**: Core assignment model with embedded student progress
- **BlacklistedToken**: For JWT token management

### Key Features
- ✅ Assignment creation and management
- ✅ Student assignment and progress tracking
- ✅ Answer submission with question-by-question tracking
- ✅ Automatic status transitions (todo → inprogress → complete → done)
- ✅ Due date enforcement
- ✅ Permission-based access control
- ✅ Comprehensive error handling

## Assignment Schema

```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  totalQuestions: Number,
  createdBy: ObjectId, // Reference to User (admin)
  createdAt: Date,
  updatedAt: Date,
  dueDate: Date,
  students: [
    {
      studentId: ObjectId, // Reference to User (student)
      status: 'todo' | 'inprogress' | 'complete' | 'done',
      startedAt: Date,
      completedAt: Date,
      markedDoneAt: Date,
      answers: [
        {
          questionNumber: Number,
          questionText: String,
          answerText: String,
          answeredAt: Date
        }
      ]
    }
  ]
}
```

## Status Flow

```
todo → inprogress → complete → done
```

- **todo**: Initial status when assignment is assigned
- **inprogress**: Student has started working (manual trigger)
- **complete**: Student has answered all questions (automatic)
- **done**: Admin marks as reviewed/graded (manual, admin only)

## API Endpoints

### Authentication
All endpoints except health checks require authentication via `Authorization: Bearer <token>` header.

### Admin Endpoints

#### 1. Create Assignment
```http
POST /assignments
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "Math Assignment 1",
  "description": "Solve the following math problems",
  "totalQuestions": 10,
  "dueDate": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "message": "สร้างงานเรียบร้อย",
  "assignment": {
    "id": "...",
    "title": "Math Assignment 1",
    "description": "Solve the following math problems",
    "totalQuestions": 10,
    "dueDate": "2024-12-31T23:59:59Z",
    "createdBy": "...",
    "students": [],
    "statistics": {
      "totalStudents": 0,
      "statusBreakdown": {
        "todo": 0,
        "inprogress": 0,
        "complete": 0,
        "done": 0
      },
      "completionRate": 0
    }
  }
}
```

#### 2. Assign Students to Assignment
```http
POST /assignments/:id/assign
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "studentIds": ["student_id_1", "student_id_2", "student_id_3"]
}
```

#### 3. View Assignment with Progress
```http
GET /assignments/:id
Authorization: Bearer <admin_token>
```

**Response includes:**
- Assignment details
- Student progress for each assigned student
- Statistics and completion rates
- Individual student answer tracking

#### 4. Update Student Status (Mark as Done)
```http
PATCH /assignments/:id/students/:studentId/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "done"
}
```

#### 5. List All Assignments (Admin)
```http
GET /assignments?page=1&limit=10&search=keyword
Authorization: Bearer <admin_token>
```

### Student/Mixed Access Endpoints

#### 6. Start Assignment
```http
PATCH /assignments/:id/students/:studentId/start
Authorization: Bearer <token>
```
- Students can start their own assignments
- Admins can start assignments for any student
- Changes status from `todo` to `inprogress`

#### 7. Submit Answer
```http
POST /assignments/:id/students/:studentId/answers
Authorization: Bearer <token>
Content-Type: application/json

{
  "questionNumber": 1,
  "questionText": "What is 2 + 2?",
  "answerText": "4"
}
```

**Features:**
- Can update existing answers (overwrites previous answer for same question)
- Automatically marks assignment as `complete` when all questions are answered
- Validates question numbers against `totalQuestions`

#### 8. View Student's Assignments
```http
GET /students/:studentId/assignments?status=todo&page=1&limit=10
Authorization: Bearer <token>
```
- Students can only view their own assignments
- Admins can view any student's assignments
- Filter by status: `todo`, `inprogress`, `complete`, `done`

## Error Handling

### Common Error Responses

```json
// Authentication required
{
  "message": "ไม่พบ Token การยืนยันตัวตน"
}

// Insufficient permissions
{
  "message": "ไม่มีสิทธิ์เข้าถึง เฉพาะ Admin เท่านั้น"
}

// Validation error
{
  "message": "กรุณากรอกข้อมูลให้ครบถ้วน (title, description, totalQuestions, dueDate)"
}

// Assignment not found
{
  "message": "ไม่พบงานที่ระบุ"
}

// Assignment overdue
{
  "message": "งานนี้หมดเวลาแล้ว"
}
```

## Business Rules

### Assignment Creation
- Only admins can create assignments
- Due date must be in the future
- Total questions must be between 1-100

### Student Assignment
- Only approved students can be assigned
- No duplicate assignments to same student
- Cannot assign to overdue assignments

### Answer Submission
- Only during assignment's active period (before due date)
- Student must be in `inprogress` status
- Question numbers must be valid (1 to totalQuestions)
- Answers can be updated until assignment is complete

### Status Management
- `todo` → `inprogress`: Student or admin can trigger
- `inprogress` → `complete`: Automatic when all answers submitted
- `complete` → `done`: Only admin can mark
- Cannot submit answers after status becomes `complete` or `done`

## Security Features

### Authentication & Authorization
- JWT-based authentication with token blacklisting
- Role-based access control (Admin/Student)
- Student approval system
- Resource ownership validation

### Data Validation
- Input sanitization and validation
- MongoDB ObjectId validation
- Date and number range validation
- Duplicate prevention

### Access Control
- Students can only access their own data
- Admins have full access to all assignments
- Assignment ownership validation
- Due date enforcement

## Database Indexes

```javascript
// Assignment collection indexes
{ createdBy: 1, createdAt: -1 }
{ 'students.studentId': 1 }
{ dueDate: 1 }
{ createdAt: -1 }
```

## Performance Considerations

- Embedded student progress for efficient queries
- Pagination support for large datasets
- Selective field population
- Efficient aggregation for statistics

## Health Check

```http
GET /assignments/health
```

Returns system status and available features.

## Installation & Setup

1. **Dependencies**: All required packages already in package.json
2. **Database**: MongoDB with existing User collection
3. **Environment**: JWT_SECRET configured
4. **Routes**: Automatically mounted on `/assignments`

## Usage Examples

### Complete Student Flow

1. **Admin creates assignment**
```bash
curl -X POST http://localhost:3000/assignments \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Weekly Math Quiz",
    "description": "Complete all 5 problems",
    "totalQuestions": 5,
    "dueDate": "2024-12-31T23:59:59Z"
  }'
```

2. **Admin assigns to students**
```bash
curl -X POST http://localhost:3000/assignments/$ASSIGNMENT_ID/assign \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentIds": ["'$STUDENT_ID'"]}'
```

3. **Student starts assignment**
```bash
curl -X PATCH http://localhost:3000/assignments/$ASSIGNMENT_ID/students/$STUDENT_ID/start \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

4. **Student submits answers**
```bash
curl -X POST http://localhost:3000/assignments/$ASSIGNMENT_ID/students/$STUDENT_ID/answers \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionNumber": 1,
    "questionText": "What is 5 + 3?",
    "answerText": "8"
  }'
```

5. **Admin marks as done**
```bash
curl -X PATCH http://localhost:3000/assignments/$ASSIGNMENT_ID/students/$STUDENT_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

## Integration Notes

- Built on existing authentication system
- Extends current User model without modifications
- Uses existing middleware patterns
- Compatible with current CORS configuration
- Follows existing error handling conventions

This assignment system is now fully integrated and ready for use!
