/**
 * User Controller - HTTP request handlers
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getUserService } from '../../src/services/userService';
import { getAuthService } from '../../src/services/authService';
import { getReportService } from '../../src/services/reportService';
import { getInquiryService } from '../../src/services/inquiryService';
import { getDatabaseService } from '../../src/services/database';

export async function getUserProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const userService = getUserService();
  const profile = await userService.getUserProfile(userId);

  res.json({
    success: true,
    data: profile,
  });
}

export async function updateUserProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const updates = req.body;

  const userService = getUserService();
  const updatedProfile = await userService.updateUserProfile(userId, updates);

  res.json({
    success: true,
    data: updatedProfile,
    message: 'Profile updated successfully',
  });
}

export async function initiatePasswordReset(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Email is required',
    });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid email format',
    });
    return;
  }

  const authService = getAuthService();
  await authService.initiatePasswordReset(email);

  res.json({
    success: true,
    message: 'Password reset code sent to email',
  });
}

export async function confirmPasswordReset(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Email, code, and newPassword are required',
    });
    return;
  }

  const authService = getAuthService();
  await authService.confirmPasswordReset(email, code, newPassword);

  res.json({
    success: true,
    message: 'Password reset successfully',
  });
}

export async function deleteAccount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  console.log('[deleteAccount] Starting account deletion process');
  const userId = req.user!.userId;

  const userService = getUserService();
  const authService = getAuthService();

  // 1. DB에서 유저 삭제
  try {
    console.log('[deleteAccount] Deleting user from database...');
    await userService.deleteUser(userId);
    console.log('[deleteAccount] User deleted from database successfully');
  } catch (error: any) {
    console.error('[deleteAccount] Failed to delete user from database:', error);
    res.status(500).json({
      error: 'DatabaseError',
      message: 'Failed to delete user from database',
    });
    return;
  }

  // 2. Cognito에서 유저 삭제
  try {
    console.log('[deleteAccount] Deleting user from Cognito...');
    await authService.deleteUser(userId);
    console.log('[deleteAccount] User deleted from Cognito successfully');
  } catch (error: any) {
    // DB는 이미 삭제됐으므로 Cognito 실패해도 성공 응답
    console.error('[deleteAccount] Failed to delete user from Cognito:', error.message);
  }

  // 3. S3에서 유저 폴더 삭제
  try {
    console.log('[deleteAccount] Deleting user folder from S3...');
    const { getS3Service } = await import('../../src/services/s3Service');
    const s3Service = getS3Service();
    await s3Service.deleteUserFolder(userId);
    console.log('[deleteAccount] User folder deleted from S3 successfully');
  } catch (error: any) {
    // S3 삭제 실패해도 계정 삭제는 성공으로 처리
    console.error('[deleteAccount] Failed to delete user folder from S3:', error.message);
  }

  res.json({
    success: true,
    message: 'Account deleted successfully',
  });
}

export async function createReport(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const reporterId = req.user!.userId;
  const { reported_user_identifier, reason, description } = req.body;

  if (!reported_user_identifier || !reason) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'reported_user_identifier (nickname or email) and reason are required',
    });
    return;
  }

  const reportService = getReportService();
  const db = getDatabaseService();

  let reportedUserId: string;
  
  try {
    if (reported_user_identifier.includes('@')) {
      const result = await db.query(
        "SELECT user_id FROM users WHERE email = $1 AND status != 'deleted'",
        [reported_user_identifier]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'UserNotFound',
          message: '해당 이메일의 사용자를 찾을 수 없습니다.',
        });
        return;
      }
      
      reportedUserId = result.rows[0].user_id;
    } else {
      const result = await db.query(
        "SELECT user_id FROM users WHERE nickname = $1 AND status != 'deleted'",
        [reported_user_identifier]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'UserNotFound',
          message: '해당 닉네임의 사용자를 찾을 수 없습니다.',
        });
        return;
      }
      
      reportedUserId = result.rows[0].user_id;
    }
  } catch (error) {
    console.error('Error finding user:', error);
    res.status(500).json({
      error: 'InternalError',
      message: '사용자 조회 중 오류가 발생했습니다.',
    });
    return;
  }

  const report = await reportService.createReport({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reason,
    description,
  });

  res.status(201).json({
    success: true,
    data: report,
    message: 'Report submitted successfully',
  });
}

export async function createInquiry(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const { subject, message } = req.body;

  if (!subject || !message) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Subject and message are required',
    });
    return;
  }

  const inquiryService = getInquiryService();
  const inquiry = await inquiryService.createInquiry({
    user_id: userId,
    subject,
    message,
  });

  res.status(201).json({
    success: true,
    data: inquiry,
    message: `Inquiry created successfully. Inquiry ID: ${inquiry.inquiryId}`,
  });
}

export async function getUserInquiries(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const inquiryService = getInquiryService();
  const inquiries = await inquiryService.getUserInquiries(userId);

  res.json({
    success: true,
    data: inquiries,
  });
}

export async function uploadProfileImage(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'No image file provided',
    });
    return;
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
    });
    return;
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'File too large. Maximum size is 5MB',
    });
    return;
  }

  const userService = getUserService();
  const result = await userService.uploadProfileImage(
    userId,
    file.buffer,
    file.mimetype,
    file.originalname
  );

  res.json({
    success: true,
    data: {
      imageUrl: result.imageUrl,
      profile: result.profile,
    },
    message: 'Profile image uploaded successfully',
  });
}

export async function deleteProfileImage(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const userId = req.user!.userId;
  const userService = getUserService();
  const profile = await userService.deleteProfileImage(userId);

  res.json({
    success: true,
    data: profile,
    message: 'Profile image deleted successfully',
  });
}
