import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
// กำหนด enum สำหรับ role และ status
export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["STUDENT"] = "student";
})(UserRole || (UserRole = {}));
export var UserStatus;
(function (UserStatus) {
    UserStatus["PENDING"] = "pending";
    UserStatus["APPROVED"] = "approved";
    UserStatus["REJECTED"] = "rejected"; // ปฏิเสธ
})(UserStatus || (UserStatus = {}));
const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.STUDENT
    },
    status: {
        type: String,
        enum: Object.values(UserStatus),
        default: UserStatus.PENDING
    },
    // ข้อมูลส่วนตัว (จำเป็นสำหรับ student)
    firstName: {
        type: String,
        required: function () {
            return this.role === UserRole.STUDENT;
        },
        trim: true
    },
    lastName: {
        type: String,
        required: function () {
            return this.role === UserRole.STUDENT;
        },
        trim: true
    },
    nickname: {
        type: String,
        trim: true
    },
    school: {
        type: String,
        required: function () {
            return this.role === UserRole.STUDENT;
        },
        trim: true
    },
    purpose: {
        type: String,
        required: function () {
            return this.role === UserRole.STUDENT;
        },
        trim: true,
        maxlength: 500
    },
    // ข้อมูลการอนุมัติ
    approvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: {
        type: String,
        maxlength: 200
    }
}, {
    timestamps: true
});
// Index สำหรับการค้นหา
UserSchema.index({ status: 1, role: 1 });
UserSchema.index({ createdAt: -1 });
// Pre-save middleware สำหรับ hash password
UserSchema.pre('save', async function (next) {
    // Hash password เฉพาะเมื่อมีการเปลี่ยนแปลง
    if (!this.isModified('password'))
        return next();
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
// Method สำหรับเปรียบเทียบ password
UserSchema.methods.comparePassword = function (candidate) {
    return bcrypt.compare(candidate, this.password);
};
// Method สำหรับดึงข้อมูล public profile (ไม่รวม password)
UserSchema.methods.getPublicProfile = function () {
    const userObject = this.toObject();
    delete userObject.password;
    // Transform _id to id for frontend compatibility
    if (userObject._id) {
        userObject.id = userObject._id.toString();
        delete userObject._id;
    }
    return userObject;
};
// Virtual สำหรับชื่อเต็ม
UserSchema.virtual('fullName').get(function () {
    if (this.firstName && this.lastName) {
        return `${this.firstName} ${this.lastName}`;
    }
    return this.username;
});
// Ensure virtual fields are serialized
UserSchema.set('toJSON', { virtuals: true });
export default mongoose.model('User', UserSchema);
