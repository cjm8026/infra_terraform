/**
 * User Routes - API endpoints
 */

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import * as userController from '../controllers/userController';

const router = Router();

// Multer config for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Profile endpoints
router.get('/profile', authMiddleware, asyncHandler(userController.getUserProfile));
router.put('/profile', authMiddleware, asyncHandler(userController.updateUserProfile));

// Profile image endpoints
router.post('/profile/image', authMiddleware, upload.single('image'), asyncHandler(userController.uploadProfileImage));
router.delete('/profile/image', authMiddleware, asyncHandler(userController.deleteProfileImage));

// Password reset endpoints
router.post('/password-reset', asyncHandler(userController.initiatePasswordReset));
router.post('/password-reset/confirm', asyncHandler(userController.confirmPasswordReset));

// Account deletion endpoint
router.delete('/account', authMiddleware, asyncHandler(userController.deleteAccount));

// Report endpoint
router.post('/report', authMiddleware, asyncHandler(userController.createReport));

// Inquiry endpoints
router.post('/inquiry', authMiddleware, asyncHandler(userController.createInquiry));
router.get('/inquiries', authMiddleware, asyncHandler(userController.getUserInquiries));

export default router;
