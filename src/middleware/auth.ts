import type { Request, Response, NextFunction } from 'express';
import { JWT_SECRET } from '../config/env.js';
import BlacklistedToken from '../models/BlacklistedToken.js';
import { UserRole } from '../models/User.js';
import jwt from 'jsonwebtoken';

// ขยาย Request interface เพื่อเพิ่ม user object
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    status: string;
  };
}

/**
 * Middleware สำหรับตรวจสอบ JWT token
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // ดึง token จาก Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'ไม่พบ Token การยืนยันตัวตน' });
    }

    const token = authHeader.split(' ')[1];

    // ตรวจสอบว่า token อยู่ใน blacklist หรือไม่
    console.log('🔍 Checking blacklist for token:', token.substring(0, 20) + '...');
    const blacklisted = await BlacklistedToken.findOne({ token });
    console.log('🔍 Blacklist result:', blacklisted ? 'FOUND (REVOKED)' : 'NOT FOUND (OK)');
    
    if (blacklisted) {
      console.log('❌ Token is blacklisted, rejecting request');
      return res.status(401).json({ message: 'Token ถูกยกเลิกแล้ว กรุณาเข้าสู่ระบบใหม่' });
    }

    // ตรวจสอบและ decode JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // เก็บข้อมูล user ใน request object
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      status: decoded.status
    };

    console.log('✅ Token verified for user:', decoded.username, 'role:', decoded.role);
    next();
  } catch (err) {
    console.error('❌ Token verification failed:', err);
    
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });
    }
    
    return res.status(401).json({ message: 'การยืนยันตัวตนล้มเหลว' });
  }
};

/**
 * Middleware สำหรับตรวจสอบสิทธิ์ Admin เท่านั้น
 */
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // ตรวจสอบว่ามี user ใน request หรือไม่
    if (!req.user) {
      return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
    }

    // ตรวจสอบว่าเป็น Admin หรือไม่
    if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ 
        message: 'ไม่มีสิทธิ์เข้าถึง เฉพาะ Admin เท่านั้น',
        requiredRole: 'admin',
        userRole: req.user.role
      });
    }

    console.log('✅ Admin access granted for user:', req.user.username);
    next();
  } catch (error) {
    console.error('❌ Admin authorization failed:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
  }
};

/**
 * Middleware สำหรับตรวจสอบสิทธิ์ Student ที่ได้รับการอนุมัติแล้ว
 */
export const requireApprovedStudent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // ตรวจสอบว่ามี user ใน request หรือไม่
    if (!req.user) {
      return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
    }

    // ตรวจสอบว่าเป็น Student หรือไม่
    if (req.user.role !== UserRole.STUDENT) {
      return res.status(403).json({ 
        message: 'ไม่มีสิทธิ์เข้าถึง เฉพาะ Student เท่านั้น',
        requiredRole: 'student',
        userRole: req.user.role
      });
    }

    // ตรวจสอบว่าได้รับการอนุมัติแล้วหรือไม่
    if (req.user.status !== 'approved') {
      return res.status(403).json({ 
        message: 'บัญชีของคุณยังไม่ได้รับการอนุมัติ',
        status: req.user.status
      });
    }

    console.log('✅ Approved student access granted for user:', req.user.username);
    next();
  } catch (error) {
    console.error('❌ Student authorization failed:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
  }
};

/**
 * Middleware สำหรับตรวจสอบว่าเป็น Admin หรือ Student ที่ได้รับอนุมัติ
 */
export const requireApprovedUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // ตรวจสอบว่ามี user ใน request หรือไม่
    if (!req.user) {
      return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
    }

    // Admin สามารถเข้าถึงได้เสมอ
    if (req.user.role === UserRole.ADMIN) {
      console.log('✅ Admin access granted for user:', req.user.username);
      return next();
    }

    // Student ต้องได้รับการอนุมัติ
    if (req.user.role === UserRole.STUDENT) {
      if (req.user.status !== 'approved') {
        return res.status(403).json({ 
          message: 'บัญชีของคุณยังไม่ได้รับการอนุมัติ',
          status: req.user.status
        });
      }
      console.log('✅ Approved student access granted for user:', req.user.username);
      return next();
    }

    // Role ไม่ถูกต้อง
    return res.status(403).json({ 
      message: 'ไม่มีสิทธิ์เข้าถึง',
      userRole: req.user.role
    });
  } catch (error) {
    console.error('❌ User authorization failed:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
  }
};

/**
 * Middleware สำหรับตรวจสอบสิทธิ์เข้าถึงข้อมูลนักเรียน
 * Admin สามารถเข้าถึงข้อมูลนักเรียนใดก็ได้
 * Student สามารถเข้าถึงข้อมูลตนเองเท่านั้น
 */
export const requireStudentAccess = (paramName: string = 'studentId') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // ตรวจสอบว่ามี user ใน request หรือไม่
      if (!req.user) {
        return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
      }

      const targetStudentId = req.params[paramName];
      
      // ตรวจสอบว่ามี studentId ใน params หรือไม่
      if (!targetStudentId) {
        return res.status(400).json({ message: 'ไม่พบ Student ID ใน request' });
      }

      // Admin สามารถเข้าถึงข้อมูลนักเรียนใดก็ได้
      if (req.user.role === UserRole.ADMIN) {
        console.log('✅ Admin access granted for student:', targetStudentId);
        return next();
      }

      // Student สามารถเข้าถึงข้อมูลตนเองเท่านั้น
      if (req.user.role === UserRole.STUDENT) {
        if (req.user.status !== 'approved') {
          return res.status(403).json({ 
            message: 'บัญชีของคุณยังไม่ได้รับการอนุมัติ',
            status: req.user.status
          });
        }

        if (req.user.id !== targetStudentId) {
          return res.status(403).json({ 
            message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนักเรียนคนอื่น' 
          });
        }

        console.log('✅ Student access granted for own data:', req.user.username);
        return next();
      }

      // Role ไม่ถูกต้อง
      return res.status(403).json({ 
        message: 'ไม่มีสิทธิ์เข้าถึง',
        userRole: req.user.role
      });
    } catch (error) {
      console.error('❌ Student access authorization failed:', error);
      return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
    }
  };
};