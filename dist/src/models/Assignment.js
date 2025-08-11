import mongoose, { Document, Schema } from 'mongoose';
// กำหนด enum สำหรับสถานะของการทำงาน
export var AssignmentStatus;
(function (AssignmentStatus) {
    AssignmentStatus["TODO"] = "todo";
    AssignmentStatus["INPROGRESS"] = "inprogress";
    AssignmentStatus["COMPLETE"] = "complete";
    AssignmentStatus["DONE"] = "done";
})(AssignmentStatus || (AssignmentStatus = {}));
// Schema สำหรับคำตอบ
const AnswerSchema = new Schema({
    questionNumber: {
        type: Number,
        required: true,
        min: 1
    },
    questionText: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    answerText: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    answeredAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });
// Schema สำหรับข้อมูลนักเรียนในงาน
const StudentAssignmentSchema = new Schema({
    studentId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: Object.values(AssignmentStatus),
        default: AssignmentStatus.TODO
    },
    startedAt: Date,
    completedAt: Date,
    markedDoneAt: Date,
    answers: [AnswerSchema]
}, { _id: false });
// Schema หลักสำหรับ Assignment
const AssignmentSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    totalQuestions: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    students: [StudentAssignmentSchema]
}, {
    timestamps: true
});
// Index สำหรับการค้นหา
AssignmentSchema.index({ createdBy: 1, createdAt: -1 });
AssignmentSchema.index({ 'students.studentId': 1 });
AssignmentSchema.index({ dueDate: 1 });
AssignmentSchema.index({ createdAt: -1 });
// Pre-save middleware สำหรับการตรวจสอบข้อมูล
AssignmentSchema.pre('save', function (next) {
    // ตรวจสอบว่า dueDate ไม่เป็นอดีต (เฉพาะเมื่อสร้างใหม่)
    if (this.isNew && this.dueDate < new Date()) {
        return next(new Error('วันครบกำหนดต้องไม่เป็นวันที่ในอดีต'));
    }
    // ตรวจสอบว่าไม่มีนักเรียนซ้ำ
    const studentIds = this.students.map(s => s.studentId.toString());
    const uniqueIds = [...new Set(studentIds)];
    if (studentIds.length !== uniqueIds.length) {
        return next(new Error('ไม่สามารถมอบหมายงานให้นักเรียนคนเดียวกันซ้ำได้'));
    }
    next();
});
// Method สำหรับดึงข้อมูลงานพร้อมความคืบหน้า
AssignmentSchema.methods.getAssignmentWithProgress = function () {
    const assignment = this.toObject();
    // คำนวณสถิติ
    const totalStudents = assignment.students.length;
    const todoCount = assignment.students.filter((s) => s.status === AssignmentStatus.TODO).length;
    const inProgressCount = assignment.students.filter((s) => s.status === AssignmentStatus.INPROGRESS).length;
    const completeCount = assignment.students.filter((s) => s.status === AssignmentStatus.COMPLETE).length;
    const doneCount = assignment.students.filter((s) => s.status === AssignmentStatus.DONE).length;
    // เพิ่มข้อมูลความคืบหน้าให้แต่ละนักเรียน
    assignment.students = assignment.students.map((student) => ({
        ...student,
        progressPercentage: Math.round((student.answers.length / assignment.totalQuestions) * 100),
        answeredQuestions: student.answers.length,
        remainingQuestions: assignment.totalQuestions - student.answers.length
    }));
    // Transform _id to id
    if (assignment._id) {
        assignment.id = assignment._id.toString();
        delete assignment._id;
    }
    return {
        ...assignment,
        statistics: {
            totalStudents,
            statusBreakdown: {
                todo: todoCount,
                inprogress: inProgressCount,
                complete: completeCount,
                done: doneCount
            },
            completionRate: totalStudents > 0 ? Math.round(((completeCount + doneCount) / totalStudents) * 100) : 0
        }
    };
};
// Method สำหรับดึงความคืบหน้าของนักเรียนคนใดคนหนึ่ง
AssignmentSchema.methods.getStudentProgress = function (studentId) {
    const student = this.students.find((s) => s.studentId.toString() === studentId);
    if (!student)
        return null;
    return {
        ...student.toObject(),
        progressPercentage: Math.round((student.answers.length / this.totalQuestions) * 100),
        answeredQuestions: student.answers.length,
        remainingQuestions: this.totalQuestions - student.answers.length
    };
};
// Virtual สำหรับตรวจสอบว่าหมดเวลาแล้วหรือไม่
AssignmentSchema.virtual('isOverdue').get(function () {
    return new Date() > this.dueDate;
});
// Virtual สำหรับคำนวณเวลาที่เหลือ
AssignmentSchema.virtual('timeRemaining').get(function () {
    const now = new Date();
    const due = new Date(this.dueDate);
    const diffMs = due.getTime() - now.getTime();
    if (diffMs <= 0)
        return null;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { days, hours, totalHours: Math.floor(diffMs / (1000 * 60 * 60)) };
});
// Ensure virtual fields are serialized
AssignmentSchema.set('toJSON', { virtuals: true });
export default mongoose.model('Assignment', AssignmentSchema);
