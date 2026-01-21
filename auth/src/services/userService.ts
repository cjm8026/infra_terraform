/**
 * User Service Module
 */

import { getDatabaseService } from './database';
import { getS3Service } from './s3Service';
import { isValidNickname, isValidPhoneNumber, keysToCamelCase } from './databaseUtils';
import type { FullUserProfile, UpdateUserProfileData } from '../types/database';

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

export class NicknameAlreadyExistsError extends Error {
  constructor(nickname: string) {
    super(`Nickname already exists: ${nickname}`);
    this.name = 'NicknameAlreadyExistsError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UserService {
  async getUserProfile(userId: string): Promise<FullUserProfile> {
    const db = getDatabaseService();

    const query = `
      SELECT 
        u.user_id,
        u.email,
        u.nickname,
        u.status,
        u.created_at,
        u.updated_at,
        p.profile_image_url,
        p.bio,
        p.phone_number
      FROM users u
      LEFT JOIN user_profiles p ON u.user_id = p.user_id
      WHERE u.user_id = $1 AND u.status != 'deleted'
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new UserNotFoundError(userId);
    }

    return keysToCamelCase<FullUserProfile>(result.rows[0]);
  }

  async updateUserProfile(
    userId: string,
    updates: UpdateUserProfileData
  ): Promise<FullUserProfile> {
    const db = getDatabaseService();

    if (updates.nickname !== undefined) {
      if (updates.nickname.length < 2 || updates.nickname.length > 20) {
        throw new ValidationError('Nickname must be between 2 and 20 characters');
      }

      if (!isValidNickname(updates.nickname)) {
        throw new ValidationError('Nickname can only contain Korean, English letters, numbers, and underscores');
      }

      const isAvailable = await this.checkNicknameAvailability(updates.nickname, userId);
      if (!isAvailable) {
        throw new NicknameAlreadyExistsError(updates.nickname);
      }
    }

    if (updates.bio !== undefined && updates.bio.length > 500) {
      throw new ValidationError('Bio must not exceed 500 characters');
    }

    if (updates.phone_number !== undefined && updates.phone_number !== null && updates.phone_number !== '') {
      if (!isValidPhoneNumber(updates.phone_number)) {
        throw new ValidationError('Invalid phone number format');
      }
    }

    return await db.transaction(async (client) => {
      if (updates.nickname !== undefined) {
        await client.query(
          'UPDATE users SET nickname = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
          [updates.nickname, userId]
        );
      }

      const profileUpdates: any = {};
      if (updates.profile_image_url !== undefined) {
        profileUpdates.profile_image_url = updates.profile_image_url;
      }
      if (updates.bio !== undefined) {
        profileUpdates.bio = updates.bio;
      }
      if (updates.phone_number !== undefined) {
        profileUpdates.phone_number = updates.phone_number;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const setClause = Object.keys(profileUpdates)
          .map((key, index) => `${key} = $${index + 1}`)
          .join(', ');
        
        const values = Object.values(profileUpdates);
        values.push(userId);

        await client.query(
          `UPDATE user_profiles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${values.length}`,
          values
        );
      }

      const result = await client.query(`
        SELECT 
          u.user_id,
          u.email,
          u.nickname,
          u.status,
          u.created_at,
          u.updated_at,
          p.profile_image_url,
          p.bio,
          p.phone_number
        FROM users u
        LEFT JOIN user_profiles p ON u.user_id = p.user_id
        WHERE u.user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        throw new UserNotFoundError(userId);
      }

      return keysToCamelCase<FullUserProfile>(result.rows[0]);
    });
  }

  async deleteUser(userId: string): Promise<void> {
    console.log('[UserService.deleteUser] Starting deletion for user:', userId);
    const db = getDatabaseService();

    return await db.transaction(async (client) => {
      const checkResult = await client.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [userId]
      );

      if (checkResult.rows.length === 0) {
        throw new UserNotFoundError(userId);
      }

      // 먼저 존재하는 테이블 확인
      const tableCheckQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('library_items', 'journal_entries', 'user_reports', 'user_inquiries', 'user_profiles')
      `;
      const existingTables = await client.query(tableCheckQuery);
      const tableNames = new Set(existingTables.rows.map((row: any) => row.table_name));
      
      console.log('[UserService.deleteUser] Existing tables:', Array.from(tableNames).join(', '));

      // 외래 키 제약 조건을 고려한 삭제 순서
      // 1. library_items (사용자가 생성한 라이브러리 아이템)
      if (tableNames.has('library_items')) {
        await client.query('DELETE FROM library_items WHERE user_id = $1', [userId]);
        console.log('[UserService.deleteUser] Deleted library_items');
      }

      // 2. journal_entries (사용자의 일기)
      if (tableNames.has('journal_entries')) {
        await client.query('DELETE FROM journal_entries WHERE user_id = $1', [userId]);
        console.log('[UserService.deleteUser] Deleted journal_entries');
      }

      // 3. user_reports (신고 내역)
      if (tableNames.has('user_reports')) {
        await client.query(
          'DELETE FROM user_reports WHERE reporter_id = $1 OR reported_user_id = $1',
          [userId]
        );
        console.log('[UserService.deleteUser] Deleted user_reports');
      }

      // 4. user_inquiries (문의 내역)
      if (tableNames.has('user_inquiries')) {
        await client.query('DELETE FROM user_inquiries WHERE user_id = $1', [userId]);
        console.log('[UserService.deleteUser] Deleted user_inquiries');
      }

      // 5. user_profiles (사용자 프로필)
      if (tableNames.has('user_profiles')) {
        await client.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
        console.log('[UserService.deleteUser] Deleted user_profiles');
      }

      // 6. users (사용자 기본 정보 - 마지막에 삭제)
      await client.query('DELETE FROM users WHERE user_id = $1', [userId]);
      console.log('[UserService.deleteUser] Deleted users');
      
      console.log('[UserService.deleteUser] Deletion completed successfully');
    });
  }

  async checkNicknameAvailability(nickname: string, excludeUserId?: string): Promise<boolean> {
    const db = getDatabaseService();

    let query = "SELECT user_id FROM users WHERE nickname = $1 AND status != 'deleted'";
    const params: any[] = [nickname];

    if (excludeUserId) {
      query += ' AND user_id != $2';
      params.push(excludeUserId);
    }

    const result = await db.query(query, params);
    return result.rows.length === 0;
  }

  async createUser(userId: string, email: string, nickname: string): Promise<FullUserProfile> {
    const db = getDatabaseService();

    return await db.transaction(async (client) => {
      await client.query(
        `INSERT INTO users (user_id, email, nickname, status) VALUES ($1, $2, $3, 'active')`,
        [userId, email, nickname]
      );

      await client.query(`INSERT INTO user_profiles (user_id) VALUES ($1)`, [userId]);

      const result = await client.query(`
        SELECT 
          u.user_id, u.email, u.nickname, u.status, u.created_at, u.updated_at,
          p.profile_image_url, p.bio, p.phone_number
        FROM users u
        LEFT JOIN user_profiles p ON u.user_id = p.user_id
        WHERE u.user_id = $1
      `, [userId]);

      return keysToCamelCase<FullUserProfile>(result.rows[0]);
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    const db = getDatabaseService();
    await db.query(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );
  }

  /**
   * Upload profile image and update DB
   */
  async uploadProfileImage(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<{ imageUrl: string; profile: FullUserProfile }> {
    const db = getDatabaseService();
    const s3Service = getS3Service();

    // Get current profile to check for existing image
    const currentProfile = await this.getUserProfile(userId);
    
    // Delete old image if exists
    if (currentProfile.profileImageUrl) {
      await s3Service.deleteProfileImage(currentProfile.profileImageUrl);
    }

    // Upload new image to S3
    const imageUrl = await s3Service.uploadProfileImage(
      userId,
      fileBuffer,
      mimeType,
      originalName
    );

    // Update DB with new image URL
    await db.query(
      'UPDATE user_profiles SET profile_image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [imageUrl, userId]
    );

    // Return updated profile
    const updatedProfile = await this.getUserProfile(userId);
    
    return {
      imageUrl,
      profile: updatedProfile,
    };
  }

  /**
   * Delete profile image
   */
  async deleteProfileImage(userId: string): Promise<FullUserProfile> {
    const db = getDatabaseService();
    const s3Service = getS3Service();

    // Get current profile
    const currentProfile = await this.getUserProfile(userId);
    
    // Delete from S3 if exists
    if (currentProfile.profileImageUrl) {
      await s3Service.deleteProfileImage(currentProfile.profileImageUrl);
    }

    // Update DB
    await db.query(
      'UPDATE user_profiles SET profile_image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );

    return await this.getUserProfile(userId);
  }
}

let userServiceInstance: UserService | null = null;

export function getUserService(): UserService {
  if (!userServiceInstance) {
    userServiceInstance = new UserService();
  }
  return userServiceInstance;
}
