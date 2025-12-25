import type { Request, Response } from 'express';
import Assignment, { AssignmentStatus } from '../models/Assignment.js';
import User, { UserRole } from '../models/User.js';
import type { AuthRequest } from '../middleware/auth.js';
import mongoose from 'mongoose';

/**
 * สร้างงานใหม่ (เฉพาะ Admin)
 * POST /assignments
 */
export const createAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, totalQuestions, dueDate, studentIds, optionSets } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!title || !description || !totalQuestions || !dueDate) {
      return res.status(400).json({ 
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (title, description, totalQuestions, dueDate)' 
      });
    }

    // ตรวจสอบรูปแบบข้อมูล
    if (typeof totalQuestions !== 'number' || totalQuestions < 1 || totalQuestions > 100) {
      return res.status(400).json({ 
        message: 'จำนวนข้อต้องเป็นตัวเลข 1-100' 
      });
    }

    // ตรวจสอบ dueDate
    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({ 
        message: 'รูปแบบวันครบกำหนดไม่ถูกต้อง' 
      });
    }

    if (dueDateObj < new Date()) {
      return res.status(400).json({ 
        message: 'วันครบกำหนดต้องไม่เป็นวันที่ในอดีต' 
      });
    }

    // ตรวจสอบ option sets ถ้ามี
    let validatedOptionSets: any[] = [];
    if (optionSets && Array.isArray(optionSets) && optionSets.length > 0) {
      // ตรวจสอบว่า totalQuestions ตรงกับผลรวมของ option sets
      const totalQuestionsInSets = optionSets.reduce((sum, set) => sum + (set.numQuestions || 0), 0);
      if (totalQuestionsInSets !== totalQuestions) {
        return res.status(400).json({
          message: `จำนวนข้อใน option sets (${totalQuestionsInSets}) ไม่ตรงกับ totalQuestions (${totalQuestions})`
        });
      }

      // ตรวจสอบแต่ละ option set
      for (let i = 0; i < optionSets.length; i++) {
        const set = optionSets[i];
        if (!set.options || !set.numQuestions) {
          return res.status(400).json({
            message: `Option set ${i + 1} ไม่มี options หรือ numQuestions`
          });
        }
        
        if (set.numQuestions < 1) {
          return res.status(400).json({
            message: `Option set ${i + 1} ต้องมีจำนวนข้ออย่างน้อย 1 ข้อ`
          });
        }

        // ตรวจสอบ options structure
        if (!set.options.totalCount || !set.options.operatorMode || !set.options.operatorCount) {
          return res.status(400).json({
            message: `Option set ${i + 1} มี options ไม่ครบถ้วน`
          });
        }

        // Normalize options to ensure all fields are persisted
        const opts = set.options;
        
        // ✅ DEBUG: Log incoming options
        console.log(`[Backend] Option set ${i + 1} - Raw options:`, JSON.stringify(opts, null, 2));
        console.log(`[Backend] Option set ${i + 1} - lockMode:`, opts.lockMode, 'isLockPos:', opts.isLockPos);
        
        // Normalize lock mode: support both lockMode and isLockPos (and various aliases)
        const rawLockMode =
          opts.lockMode ??
          opts.isLockPos ??
          opts.islockpos ??
          opts.isLockPosition ??
          opts.islockposition ??
          opts.lockPositionMode ??
          opts.lockpositionmode ??
          opts.posLockMode ??
          opts.poslockmode ??
          false;
        
        // Convert string 'true'/'false' to boolean if needed
        const lockMode =
          typeof rawLockMode === "string"
            ? rawLockMode.toLowerCase() === "true"
            : Boolean(rawLockMode);
        
        // Calculate lockCount: when lockMode is true, lockCount = totalCount - 8
        const totalCount = Number(opts.totalCount ?? 8);
        const lockCount = lockMode ? Math.max(0, totalCount - 8) : 0;
        
        // ✅ DEBUG: Log normalized values
        console.log(`[Backend] Option set ${i + 1} - Normalized lockMode:`, lockMode, 'lockCount:', lockCount);
        
        // ✅ Use spread operator to preserve all fields, then override with normalized values
        const normalizedOptions = {
          ...opts, // Preserve all original fields
          // Override with normalized/validated values
          totalCount: opts.totalCount,
          operatorMode: opts.operatorMode,
          operatorCount: opts.operatorCount,
          specificOperators: opts.specificOperators || undefined,
          equalsCount: opts.equalsCount ?? 1,
          heavyNumberCount: opts.heavyNumberCount ?? 0,
          BlankCount: opts.BlankCount ?? 0,
          zeroCount: opts.zeroCount ?? 0,
          operatorCounts: opts.operatorCounts || undefined,
          operatorFixed: {
            '+': opts.operatorFixed?.['+'] ?? null,
            '-': opts.operatorFixed?.['-'] ?? null,
            '×': opts.operatorFixed?.['×'] ?? null,
            '÷': opts.operatorFixed?.['÷'] ?? null,
            '+/-': opts.operatorFixed?.['+/-'] ?? null,
            '×/÷': opts.operatorFixed?.['×/÷'] ?? null,
          },
          equalsMode: opts.equalsMode || undefined,
          equalsMin: opts.equalsMin ?? undefined,
          equalsMax: opts.equalsMax ?? undefined,
          heavyNumberMode: opts.heavyNumberMode || undefined,
          heavyNumberMin: opts.heavyNumberMin ?? undefined,
          heavyNumberMax: opts.heavyNumberMax ?? undefined,
          blankMode: opts.blankMode || undefined,
          blankMin: opts.blankMin ?? undefined,
          blankMax: opts.blankMax ?? undefined,
          zeroMode: opts.zeroMode || undefined,
          zeroMin: opts.zeroMin ?? undefined,
          zeroMax: opts.zeroMax ?? undefined,
          operatorMin: opts.operatorMin ?? undefined,
          operatorMax: opts.operatorMax ?? undefined,
          randomSettings: opts.randomSettings ? {
            operators: opts.randomSettings.operators ?? true,
            equals: opts.randomSettings.equals ?? true,
            heavy: opts.randomSettings.heavy ?? true,
            blank: opts.randomSettings.blank ?? true,
            zero: opts.randomSettings.zero ?? true,
          } : undefined,
          // ✅ Lock position fields - normalize to isLockPos (backend canonical field)
          // IMPORTANT: These must come AFTER spread to override any existing values
          isLockPos: lockMode,
          lockMode: lockMode,
          lockCount: lockCount,
        };
        
        // ✅ DEBUG: Log final normalized options
        console.log(`[Backend] Option set ${i + 1} - Final normalizedOptions.isLockPos:`, normalizedOptions.isLockPos);

        validatedOptionSets.push({
          options: normalizedOptions,
          numQuestions: set.numQuestions,
          setLabel: set.setLabel || `Set ${i + 1}`
        });
      }
    }

    let students: any[] = [];

    // ตรวจสอบและเตรียม studentIds ถ้ามี
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      // ตรวจสอบรูปแบบ Student IDs
      const invalidIds = studentIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ 
          message: `Student ID ไม่ถูกต้อง: ${invalidIds.join(', ')}` 
        });
      }

      // ตรวจสอบว่า students มีอยู่จริงและได้รับการอนุมัติ
      const validStudents = await User.find({
        _id: { $in: studentIds },
        role: UserRole.STUDENT,
        status: 'approved'
      });

      if (validStudents.length !== studentIds.length) {
        const foundIds = validStudents.map(s => s._id.toString());
        const notFoundIds = studentIds.filter(id => !foundIds.includes(id));
        return res.status(400).json({ 
          message: `ไม่พบ Student ที่ได้รับการอนุมัติ: ${notFoundIds.join(', ')}` 
        });
      }

      // เตรียมข้อมูล students สำหรับ assignment
      students = studentIds.map(studentId => ({
        studentId: new mongoose.Types.ObjectId(studentId),
        status: AssignmentStatus.TODO,
        answers: [],
        currentQuestionSet: 0, // เริ่มจาก option set แรก
        questionsCompletedInCurrentSet: 0
      }));
    }

    // สร้างงานใหม่
    const assignment = new Assignment({
      title: title.trim(),
      description: description.trim(),
      totalQuestions,
      createdBy: new mongoose.Types.ObjectId(req.user!.id),
      dueDate: dueDateObj,
      students,
      optionSets: validatedOptionSets
    });

    await assignment.save();

    const message = studentIds && studentIds.length > 0 
      ? `สร้างงานและมอบหมายให้นักเรียน ${studentIds.length} คนเรียบร้อย`
      : 'สร้างงานเรียบร้อย';

    return res.status(201).json({
      message,
      assignment: assignment.getAssignmentWithProgress()
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * มอบหมายงานให้นักเรียน (เฉพาะ Admin)
 * POST /assignments/:id/assign
 */
export const assignStudents = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body;

    // ตรวจสอบ Assignment ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Assignment ID ไม่ถูกต้อง' });
    }

    // ตรวจสอบ studentIds
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ 
        message: 'กรุณาระบุรายการ Student IDs เป็น array ที่ไม่ว่าง' 
      });
    }

    // ตรวจสอบรูปแบบ Student IDs
    const invalidIds = studentIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        message: `Student ID ไม่ถูกต้อง: ${invalidIds.join(', ')}` 
      });
    }

    // ค้นหางาน
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    // ตรวจสอบว่าเป็นเจ้าของงานหรือไม่
    if (assignment.createdBy.toString() !== req.user!.id) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขงานนี้' });
    }

    // ตรวจสอบว่างานหมดเวลาแล้วหรือไม่
    if (assignment.dueDate < new Date()) {
      return res.status(400).json({ message: 'ไม่สามารถมอบหมายงานที่หมดเวลาแล้ว' });
    }

    // ตรวจสอบว่า students มีอยู่จริงและได้รับการอนุมัติ
    const students = await User.find({
      _id: { $in: studentIds },
      role: UserRole.STUDENT,
      status: 'approved'
    });

    if (students.length !== studentIds.length) {
      const foundIds = students.map(s => s._id.toString());
      const notFoundIds = studentIds.filter(id => !foundIds.includes(id));
      return res.status(400).json({ 
        message: `ไม่พบ Student ที่ได้รับการอนุมัติ: ${notFoundIds.join(', ')}` 
      });
    }

    // ตรวจสอบว่ามีนักเรียนซ้ำหรือไม่
    const currentStudentIds = assignment.students.map(s => s.studentId.toString());
    const duplicateIds = studentIds.filter(id => currentStudentIds.includes(id));
    
    if (duplicateIds.length > 0) {
      return res.status(400).json({ 
        message: `นักเรียนคนนี้ได้รับมอบหมายงานแล้ว: ${duplicateIds.join(', ')}` 
      });
    }

    // เพิ่มนักเรียนเข้าในงาน
    const newStudents = studentIds.map(studentId => ({
      studentId: new mongoose.Types.ObjectId(studentId),
      status: AssignmentStatus.TODO,
      answers: [],
      currentQuestionSet: 0,
      questionsCompletedInCurrentSet: 0
    }));

    assignment.students.push(...newStudents);
    await assignment.save();

    return res.json({
      message: `มอบหมายงานให้นักเรียน ${studentIds.length} คนเรียบร้อย`,
      assignment: assignment.getAssignmentWithProgress()
    });
  } catch (error) {
    console.error('Assign students error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * ดูข้อมูลงานพร้อมความคืบหน้าของนักเรียน (Admin)
 * GET /assignments/:id
 */
export const getAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // ตรวจสอบ Assignment ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Assignment ID ไม่ถูกต้อง' });
    }

    // ค้นหางานพร้อมข้อมูลนักเรียน
    const assignment = await Assignment.findById(id)
      .populate('createdBy', 'username firstName lastName')
      .populate('students.studentId', 'username firstName lastName nickname school');

    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    // ตรวจสอบสิทธิ์การเข้าถึง
    if (assignment.createdBy._id.toString() !== req.user!.id) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ดูงานนี้' });
    }

    return res.json({
      assignment: assignment.getAssignmentWithProgress()
    });
  } catch (error) {
    console.error('Get assignment error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * นักเรียนเริ่มทำงาน (เปลี่ยนสถานะจาก todo เป็น inprogress)
 * PATCH /assignments/:id/students/:studentId/start
 */
export const startAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { id, studentId } = req.params;

    // ตรวจสอบ IDs
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Assignment ID หรือ Student ID ไม่ถูกต้อง' });
    }

    // ค้นหางาน
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    // ตรวจสอบว่าหมดเวลาแล้วหรือไม่
    if (assignment.dueDate < new Date()) {
      return res.status(400).json({ message: 'งานนี้หมดเวลาแล้ว' });
    }

    // ค้นหานักเรียนในงาน
    const studentIndex = assignment.students.findIndex(
      s => s.studentId.toString() === studentId
    );

    if (studentIndex === -1) {
      return res.status(404).json({ message: 'ไม่พบนักเรียนในงานนี้' });
    }

    const student = assignment.students[studentIndex];

    // ตรวจสอบสิทธิ์ (Admin หรือนักเรียนคนนั้นเอง)
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const isOwnStudent = req.user!.id === studentId;

    if (!isAdmin && !isOwnStudent) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ดำเนินการ' });
    }

    // ตรวจสอบสถานะปัจจุบัน
    if (student.status !== AssignmentStatus.TODO) {
      return res.status(400).json({ 
        message: `ไม่สามารถเริ่มงานได้ สถานะปัจจุบัน: ${student.status}` 
      });
    }

    // อัปเดตสถานะ
    assignment.students[studentIndex].status = AssignmentStatus.INPROGRESS;
    assignment.students[studentIndex].startedAt = new Date();

    await assignment.save();

    return res.json({
      message: 'เริ่มทำงานเรียบร้อย',
      studentProgress: assignment.getStudentProgress(studentId)
    });
  } catch (error) {
    console.error('Start assignment error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * นักเรียนส่งคำตอบ
 * POST /assignments/:id/students/:studentId/answers
 */
export const submitAnswer = async (req: AuthRequest, res: Response) => {
  try {
    const { id, studentId } = req.params;
    const { questionNumber, questionText, answerText, listPosLock } = req.body as {
      questionNumber: number;
      questionText: string;
      answerText: string;
      listPosLock?: { pos: number; value: string }[];
    };    

    // ตรวจสอบ IDs
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Assignment ID หรือ Student ID ไม่ถูกต้อง' });
    }

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!questionNumber || !questionText || !answerText) {
      return res.status(400).json({ 
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (questionNumber, questionText, answerText)' 
      });
    }

    // ตรวจสอบรูปแบบ questionNumber
    if (typeof questionNumber !== 'number' || questionNumber < 1) {
      return res.status(400).json({ message: 'หมายเลขข้อต้องเป็นตัวเลขที่มากกว่า 0' });
    }

    // ค้นหางาน
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    // ตรวจสอบว่าหมดเวลาแล้วหรือไม่
    if (assignment.dueDate < new Date()) {
      return res.status(400).json({ message: 'งานนี้หมดเวลาแล้ว' });
    }

    // ตรวจสอบ questionNumber ไม่เกินจำนวนข้อทั้งหมด
    if (questionNumber > assignment.totalQuestions) {
      return res.status(400).json({ 
        message: `หมายเลขข้อไม่ถูกต้อง ข้อสูงสุดคือ ${assignment.totalQuestions}` 
      });
    }

    // ค้นหานักเรียนในงานเพื่อเช็ค currentQuestionSet
    const studentIndex = assignment.students.findIndex(
      s => s.studentId.toString() === studentId
    );

    if (studentIndex === -1) {
      return res.status(404).json({ message: 'ไม่พบนักเรียนในงานนี้' });
    }

    const student = assignment.students[studentIndex];

    // ✅ เช็คว่า assignment มี isLockPos หรือไม่ จาก current option set
    const hasLockPosEnabled = assignment.optionSets && 
      assignment.optionSets.length > 0 && 
      assignment.optionSets[student.currentQuestionSet]?.options?.isLockPos === true;

    // ✅ Validate listPosLock เฉพาะเมื่อ assignment มี isLockPos เป็น true
    if (hasLockPosEnabled && listPosLock !== undefined) {
      if (!Array.isArray(listPosLock)) {
        return res.status(400).json({ message: 'listPosLock ต้องเป็น array' });
      }
      for (const item of listPosLock) {
        if (typeof item?.pos !== 'number' || item.pos < 0) {
          return res.status(400).json({ message: 'listPosLock.pos ต้องเป็น number >= 0' });
        }
        if (typeof item?.value !== 'string' || item.value.trim() === '') {
          return res.status(400).json({ message: 'listPosLock.value ต้องเป็น string ที่ไม่ว่าง' });
        }
      }
    }

    // ตรวจสอบสิทธิ์ (Admin หรือนักเรียนคนนั้นเอง)
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const isOwnStudent = req.user!.id === studentId;

    if (!isAdmin && !isOwnStudent) {
      return res.status(403).json({ 
        message: 'ไม่มีสิทธิ์ดำเนินการ' 
      });
    }

    // ตรวจสอบสถานะ (ต้องเป็น inprogress)
    if (student.status !== AssignmentStatus.INPROGRESS) {
      return res.status(400).json({ 
        message: `ไม่สามารถส่งคำตอบได้ สถานะปัจจุบัน: ${student.status}` 
      });
    }

    // ตรวจสอบว่าข้อนี้ตอบแล้วหรือยัง
    const existingAnswerIndex = student.answers.findIndex(
      a => a.questionNumber === questionNumber
    );

    const stu = assignment.students[studentIndex];

    const newAnswer = {
      questionNumber,
      questionText: questionText.trim(),
      answerText: answerText.trim(),
      answeredAt: new Date(),
      listPosLock: Array.isArray(listPosLock)
        ? listPosLock
        : (stu.currentQuestionListPosLock ?? undefined),
    };


    if (existingAnswerIndex >= 0) {
      // แก้ไขคำตอบเดิม
      assignment.students[studentIndex].answers[existingAnswerIndex] = newAnswer;
    } else {
      // เพิ่มคำตอบใหม่
      assignment.students[studentIndex].answers.push(newAnswer);
      assignment.students[studentIndex].questionsCompletedInCurrentSet += 1;
    }

    // Clear persisted current question after submission
    assignment.students[studentIndex].currentQuestionListPosLock = null;
    assignment.students[studentIndex].currentQuestionSolutionTokens = null;

    // ตรวจสอบ progression logic ถ้ามี option sets
    if (assignment.optionSets && assignment.optionSets.length > 0) {
      const currentSetIndex = assignment.students[studentIndex].currentQuestionSet;
      const currentSet = assignment.optionSets[currentSetIndex];
      
      if (currentSet && assignment.students[studentIndex].questionsCompletedInCurrentSet >= currentSet.numQuestions) {
        // เปลี่ยนไป option set ถัดไป
        if (currentSetIndex + 1 < assignment.optionSets.length) {
          assignment.students[studentIndex].currentQuestionSet = currentSetIndex + 1;
          assignment.students[studentIndex].questionsCompletedInCurrentSet = 0;
        }
      }
    }

    // ตรวจสอบว่าตอบครบทุกข้อแล้วหรือไม่
    const currentAnswerCount = assignment.students[studentIndex].answers.length;
    if (currentAnswerCount >= assignment.totalQuestions) {
      assignment.students[studentIndex].status = AssignmentStatus.COMPLETE;
      assignment.students[studentIndex].completedAt = new Date();
    }

    await assignment.save();

    return res.json({
      message: existingAnswerIndex >= 0 ? 'แก้ไขคำตอบเรียบร้อย' : 'บันทึกคำตอบเรียบร้อย',
      studentProgress: assignment.getStudentProgress(studentId)
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * ดึงคำตอบของนักเรียนแบบเฉพาะเจาะจง (lazy load)
 * GET /assignments/:id/students/:studentId/answers
 */
export const getStudentAnswers = async (req: AuthRequest, res: Response) => {
  try {
    const { id, studentId } = req.params;

    // ตรวจสอบ IDs
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Assignment ID หรือ Student ID ไม่ถูกต้อง' });
    }

    // ค้นหางาน
    const assignment = await Assignment.findById(id).select('students createdBy totalQuestions');
    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    // ตรวจสอบสิทธิ์ (Admin หรือนักเรียนคนนั้นเอง)
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const isOwnStudent = req.user!.id === studentId;
    if (!isAdmin && !isOwnStudent) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ดูคำตอบของนักเรียนคนนี้' });
    }

    // ดึงข้อมูลนักเรียนจากงานนี้
    const student = assignment.students.find(s => s.studentId.toString() === studentId);
    if (!student) {
      return res.status(404).json({ message: 'ไม่พบนักเรียนในงานนี้' });
    }

    // เรียงคำตอบตามหมายเลขข้อและเวลาที่ตอบ
    const answers = [...(student.answers || [])]
      .sort((a, b) => a.questionNumber - b.questionNumber || new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime())
      .map(a => ({
        questionNumber: a.questionNumber,
        questionText: a.questionText,
        answerText: a.answerText,
        answeredAt: a.answeredAt
      }));

    return res.json({
      studentId,
      assignmentId: id,
      totalQuestions: assignment.totalQuestions,
      answers,
      answeredCount: answers.length
    });
  } catch (error) {
    console.error('Get student answers error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * อัปเดตสถานะของนักเรียน (เฉพาะ Admin)
 * PATCH /assignments/:id/students/:studentId/status
 */
export const updateStudentStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id, studentId } = req.params;
    const { status } = req.body;

    // ตรวจสอบ IDs
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Assignment ID หรือ Student ID ไม่ถูกต้อง' });
    }

    // ตรวจสอบ status
    if (!status || !Object.values(AssignmentStatus).includes(status)) {
      return res.status(400).json({ 
        message: `สถานะไม่ถูกต้อง ต้องเป็นหนึ่งใน: ${Object.values(AssignmentStatus).join(', ')}` 
      });
    }

    // ค้นหางาน
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    // ตรวจสอบสิทธิ์ (เฉพาะเจ้าของงาน)
    if (assignment.createdBy.toString() !== req.user!.id) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขงานนี้' });
    }

    // ค้นหานักเรียนในงาน
    const studentIndex = assignment.students.findIndex(
      s => s.studentId.toString() === studentId
    );

    if (studentIndex === -1) {
      return res.status(404).json({ message: 'ไม่พบนักเรียนในงานนี้' });
    }

    const currentStatus = assignment.students[studentIndex].status;

    // ตรวจสอบการเปลี่ยนสถานะที่อนุญาต
    if (status === AssignmentStatus.DONE && currentStatus !== AssignmentStatus.COMPLETE) {
      return res.status(400).json({ 
        message: 'สามารถเปลี่ยนเป็น done ได้เฉพาะจากสถานะ complete เท่านั้น' 
      });
    }

    // อัปเดตสถานะ
    assignment.students[studentIndex].status = status;

    // เพิ่มเวลาสำหรับสถานะพิเศษ
    if (status === AssignmentStatus.DONE) {
      assignment.students[studentIndex].markedDoneAt = new Date();
    }

    await assignment.save();

    return res.json({
      message: `อัปเดตสถานะเป็น ${status} เรียบร้อย`,
      studentProgress: assignment.getStudentProgress(studentId)
    });
  } catch (error) {
    console.error('Update student status error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * ดูรายละเอียดงานเฉพาะของนักเรียน
 * GET /students/:studentId/assignments/:assignmentId
 */
export const getStudentAssignment = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, assignmentId } = req.params;

    // ตรวจสอบ IDs
    if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({ message: 'Student ID หรือ Assignment ID ไม่ถูกต้อง' });
    }

    // ตรวจสอบสิทธิ์ (Admin หรือนักเรียนคนนั้นเอง)
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const isOwnStudent = req.user!.id === studentId;

    if (!isAdmin && !isOwnStudent) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ดูข้อมูลนักเรียนคนนี้' });
    }

    // ค้นหางานที่มีนักเรียนคนนี้
    const assignment = await Assignment.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      'students.studentId': new mongoose.Types.ObjectId(studentId)
    }).populate('createdBy', 'username firstName lastName');

    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุหรือนักเรียนไม่ได้รับมอบหมายงานนี้' });
    }

    // ดึงข้อมูลความคืบหน้าของนักเรียน
    const studentProgress = assignment.getStudentProgress(studentId);
    const assignmentObj = assignment.toObject();
    
    const result = {
      id: assignmentObj._id.toString(),
      title: assignmentObj.title,
      description: assignmentObj.description,
      totalQuestions: assignmentObj.totalQuestions,
      dueDate: assignmentObj.dueDate,
      createdBy: assignmentObj.createdBy,
      createdAt: assignmentObj.createdAt,
      isOverdue: new Date() > new Date(assignmentObj.dueDate),
      studentProgress
    };

    return res.json({ assignment: result });
  } catch (error) {
    console.error('Get student assignment error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * ดูงานที่ได้รับมอบหมายของนักเรียน
 * GET /students/:studentId/assignments
 */
export const getStudentAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // ตรวจสอบ Student ID
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Student ID ไม่ถูกต้อง' });
    }

    // ตรวจสอบสิทธิ์ (Admin หรือนักเรียนคนนั้นเอง)
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const isOwnStudent = req.user!.id === studentId;

    if (!isAdmin && !isOwnStudent) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ดูข้อมูลนักเรียนคนนี้' });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // สร้าง filter
    const filter: any = {
      'students.studentId': new mongoose.Types.ObjectId(studentId)
    };

    // ค้นหางานที่มีนักเรียนคนนี้
    let query = Assignment.find(filter)
      .populate('createdBy', 'username firstName lastName')
      .sort({ createdAt: -1 });

    // Pagination
    if (pageNum > 0 && limitNum > 0) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const assignments = await query.exec();
    const total = await Assignment.countDocuments(filter);

    // กรองและจัดรูปแบบข้อมูล
    const studentAssignments = assignments.map(assignment => {
      const studentProgress = assignment.getStudentProgress(studentId);
      const assignmentObj = assignment.toObject();
      
      return {
        id: assignmentObj._id.toString(),
        title: assignmentObj.title,
        description: assignmentObj.description,
        totalQuestions: assignmentObj.totalQuestions,
        dueDate: assignmentObj.dueDate,
        createdBy: assignmentObj.createdBy,
        createdAt: assignmentObj.createdAt,
        isOverdue: new Date() > new Date(assignmentObj.dueDate),
        studentProgress
      };
    }).filter(assignment => {
      // กรองตาม status ถ้ามี
      if (status && assignment.studentProgress) {
        return assignment.studentProgress.status === status;
      }
      return true;
    });

    return res.json({
      assignments: studentAssignments,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Get student assignments error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * ดูรายการ Student ที่ได้รับการอนุมัติสำหรับการมอบหมายงาน
 * GET /assignments/available-students
 */
export const getAvailableStudents = async (req: AuthRequest, res: Response) => {
  try {
    // ค้นหา Student ที่ได้รับการอนุมัติ
    const students = await User.find({
      role: UserRole.STUDENT,
      status: 'approved'
    }).select('_id username firstName lastName nickname school createdAt')
      .sort({ firstName: 1, lastName: 1 });

    // จัดรูปแบบข้อมูล
    const formattedStudents = students.map(student => ({
      id: student._id.toString(),
      username: student.username,
      firstName: student.firstName,
      lastName: student.lastName,
      nickname: student.nickname,
      school: student.school,
      fullName: `${student.firstName} ${student.lastName}${student.nickname ? ` (${student.nickname})` : ''}`,
      displayName: `${student.firstName} ${student.lastName} - ${student.school}`
    }));

    return res.json({
      students: formattedStudents,
      count: formattedStudents.length
    });
  } catch (error) {
    console.error('Get available students error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * ดูรายการงานทั้งหมดของ Admin
 * GET /assignments
 */
export const getAllAssignments = async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // สร้าง filter
    const filter: any = {
      createdBy: new mongoose.Types.ObjectId(req.user!.id)
    };

    // เพิ่มการค้นหา
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // ค้นหางาน
    const assignments = await Assignment.find(filter)
      .populate('createdBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Assignment.countDocuments(filter);

    // จัดรูปแบบข้อมูล
    const formattedAssignments = assignments.map(assignment => 
      assignment.getAssignmentWithProgress()
    );

    return res.json({
      assignments: formattedAssignments,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Get all assignments error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * ดึง option set ปัจจุบันสำหรับนักเรียน
 * GET /assignments/:id/students/:studentId/current-set
 */
export const getCurrentOptionSet = async (req: AuthRequest, res: Response) => {
  try {
    const { id, studentId } = req.params;

    // ตรวจสอบ IDs
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Assignment ID หรือ Student ID ไม่ถูกต้อง' });
    }

    // ค้นหางาน
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    // ค้นหานักเรียนในงาน
    const student = assignment.students.find(
      s => s.studentId.toString() === studentId
    );

    if (!student) {
      return res.status(404).json({ message: 'ไม่พบนักเรียนในงานนี้' });
    }

    // ตรวจสอบสิทธิ์ (Admin หรือนักเรียนคนนั้นเอง)
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const isOwnStudent = req.user!.id === studentId;

    if (!isAdmin && !isOwnStudent) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ดูข้อมูลนี้' });
    }

    // ดึง option set ปัจจุบัน
    const currentSetInfo = assignment.getNextQuestionSet(studentId);

    return res.json({
      currentSet: currentSetInfo.optionSet,
      currentSetIndex: currentSetInfo.currentSetIndex,
      questionsCompleted: currentSetInfo.questionsCompleted,
      shouldProgress: assignment.shouldProgressToNextSet(studentId),
      totalSets: assignment.optionSets ? assignment.optionSets.length : 0,
      currentQuestionElements: student.currentQuestionElements || null,
      currentQuestionSolutionTokens: student.currentQuestionSolutionTokens || null,
      currentQuestionListPosLock: student.currentQuestionListPosLock || null
    });
  } catch (error) {
    console.error('Get current option set error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

/**
 * บันทึกโจทย์ที่ถูก generate สำหรับนักเรียน (ป้องกัน refresh แล้วเปลี่ยนโจทย์)
 * PATCH /assignments/:id/students/:studentId/current-question
 */
export const setCurrentQuestionElements = async (req: AuthRequest, res: Response) => {
  try {
    const { id, studentId } = req.params;
    const { elements, solutionTokens, listPosLock } = req.body as {
      elements?: string[];
      solutionTokens?: string[];
      listPosLock?: { pos: number; value: string }[];
    };    

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Assignment ID หรือ Student ID ไม่ถูกต้อง' });
    }

    if (!Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ message: 'elements ต้องเป็น array ของ string ที่ไม่ว่าง' });
    }

    if (listPosLock !== undefined) {
      if (!Array.isArray(listPosLock)) {
        return res.status(400).json({ message: 'listPosLock ต้องเป็น array' });
      }
      for (let i = 0; i < listPosLock.length; i++) {
        const item = listPosLock[i];
        if (!item || typeof item !== 'object') {
          return res.status(400).json({ 
            message: `listPosLock[${i}] ต้องเป็น object` 
          });
        }
        if (typeof item.pos !== 'number' || item.pos < 0 || !Number.isInteger(item.pos)) {
          return res.status(400).json({ 
            message: `listPosLock[${i}].pos ต้องเป็น integer >= 0, got: ${item.pos}` 
          });
        }
        if (typeof item.value !== 'string') {
          return res.status(400).json({ 
            message: `listPosLock[${i}].value ต้องเป็น string, got: ${typeof item.value}` 
          });
        }
        if (item.value.trim() === '') {
          return res.status(400).json({ 
            message: `listPosLock[${i}].value ต้องไม่ว่าง` 
          });
        }
        // ✅ IMPORTANT: elements is rack elements (excludes locked tiles), but listPosLock.pos is solutionTokens indices
        // So we cannot validate pos against elements.length
        // Instead, we validate that pos is non-negative and reasonable (max 20 tiles total)
        if (item.pos < 0) {
          return res.status(400).json({ 
            message: `listPosLock[${i}].pos (${item.pos}) ต้องเป็น non-negative integer` 
          });
        }
        if (item.pos >= 20) {
          return res.status(400).json({ 
            message: `listPosLock[${i}].pos (${item.pos}) เกินค่าสูงสุดที่อนุญาต (20)` 
          });
        }
        // ✅ Note: We don't validate pos against elements.length because:
        // - elements = rack elements (excludes locked tiles, typically 8 tiles)
        // - listPosLock.pos = solutionTokens indices (includes locked tiles, typically 10-15 tiles)
        // - So pos can be >= elements.length, which is expected
      }
    }
    

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    const studentIndex = assignment.students.findIndex(
      s => s.studentId.toString() === studentId
    );
    if (studentIndex === -1) {
      return res.status(404).json({ message: 'ไม่พบนักเรียนในงานนี้' });
    }

    // ตรวจสอบสิทธิ์ (Admin หรือนักเรียนคนนั้นเอง)
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const isOwnStudent = req.user!.id === studentId;
    if (!isAdmin && !isOwnStudent) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ดำเนินการ' });
    }

    const stu = assignment.students[studentIndex];

    // ✅ บันทึกเฉพาะเมื่อยังไม่มี elements (กัน refresh overwrite)
    // ✅ IMPORTANT: listPosLock ควรจะไม่ถูก overwrite ถ้ามีอยู่แล้วใน DB
    // ยกเว้นเมื่อส่ง listPosLock มาอย่างชัดเจนและต่างจากที่มีอยู่
    const shouldSetElements =
      !stu.currentQuestionElements || stu.currentQuestionElements.length === 0;
    
    // ✅ บันทึก solutionTokens เมื่อยังไม่มี หรือเมื่อมี elements ใหม่
    const shouldSetSolutionTokens =
      !stu.currentQuestionSolutionTokens || stu.currentQuestionSolutionTokens.length === 0 ||
      (solutionTokens && solutionTokens.length > 0);

    // ✅ Check if listPosLock should be updated
    // IMPORTANT: Protect existing lock positions from being overwritten on refresh
    // Only update if:
    // 1. listPosLock is explicitly provided (not undefined), AND
    // 2. Either no existing lock positions in DB, OR the new one is different
    // 3. If listPosLock is null/empty and existing exists, don't overwrite (protect from refresh)
    const existingLockPos = stu.currentQuestionListPosLock;
    const hasExistingLockPos = existingLockPos && existingLockPos.length > 0;
    const existingLockPosKey = hasExistingLockPos
      ? JSON.stringify(existingLockPos.sort((a, b) => a.pos - b.pos))
      : 'null';
    const newLockPosKey = listPosLock && listPosLock.length > 0
      ? JSON.stringify(listPosLock.sort((a, b) => a.pos - b.pos))
      : 'null';
    
    // ✅ CRITICAL: Don't overwrite existing lock positions with null/empty on refresh
    // If existing lock positions exist and new one is null/empty, keep existing
    const shouldSetLockPos = listPosLock !== undefined && (
      !hasExistingLockPos || // No existing lock positions - safe to set
      (newLockPosKey !== 'null' && existingLockPosKey !== newLockPosKey) // New non-empty and different
    );

    console.log('💾 setCurrentQuestionElements:', {
      assignmentId: id,
      studentId,
      elementsCount: elements.length,
      listPosLockCount: listPosLock?.length ?? 0,
      shouldSetElements,
      shouldSetLockPos,
      hasExistingElements: !!stu.currentQuestionElements && stu.currentQuestionElements.length > 0,
      hasExistingLockPos: !!existingLockPos && existingLockPos.length > 0,
      existingLockPosKey,
      newLockPosKey,
      lockPosChanged: existingLockPosKey !== newLockPosKey
    });

    // ✅ Use atomic update to avoid version conflict
    const updateQuery: any = {};
    
    if (shouldSetElements) {
      updateQuery[`students.${studentIndex}.currentQuestionElements`] = elements;
    }
    
    // ✅ Store solutionTokens when provided
    if (shouldSetSolutionTokens && solutionTokens && solutionTokens.length > 0) {
      updateQuery[`students.${studentIndex}.currentQuestionSolutionTokens`] = solutionTokens;
    }
    
    // ✅ Only update listPosLock if it should be updated (protect existing lock positions from refresh)
    if (shouldSetLockPos) {
      updateQuery[`students.${studentIndex}.currentQuestionListPosLock`] = Array.isArray(listPosLock) ? listPosLock : null;
    }

    // ✅ Use findOneAndUpdate with atomic operators to avoid version conflicts
    const updatedAssignment = await Assignment.findOneAndUpdate(
      { _id: id },
      { $set: updateQuery },
      { new: true, runValidators: true }
    );

    if (!updatedAssignment) {
      return res.status(404).json({ message: 'ไม่พบงานที่ระบุ' });
    }

    // Verify student still exists
    const updatedStudent = updatedAssignment.students.find(
      s => s.studentId.toString() === studentId
    );

    if (!updatedStudent) {
      return res.status(404).json({ message: 'ไม่พบนักเรียนในงานนี้' });
    }

    console.log('✅ Successfully updated elements and lock positions using atomic update');

    return res.json({
      message: 'บันทึกโจทย์ปัจจุบันเรียบร้อย',
      currentQuestionElements: updatedStudent.currentQuestionElements,
      currentQuestionSolutionTokens: updatedStudent.currentQuestionSolutionTokens ?? null,
      currentQuestionListPosLock: updatedStudent.currentQuestionListPosLock ?? null
    });    
  } catch (error) {
    console.error('❌ Set current question error:', error);
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({ 
      message: 'เกิดข้อผิดพลาดในระบบ',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
