/**
 * Inquiry Service Module
 */

import { getDatabaseService } from './database';
import { keysToCamelCase } from './databaseUtils';
import type { UserInquiry, CreateUserInquiryData } from '../types/database';

export class InquiryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InquiryValidationError';
  }
}

export class InquiryService {
  async createInquiry(inquiryData: CreateUserInquiryData): Promise<UserInquiry> {
    const db = getDatabaseService();

    if (!inquiryData.subject || inquiryData.subject.trim().length === 0) {
      throw new InquiryValidationError('Subject is required');
    }

    if (inquiryData.subject.length > 200) {
      throw new InquiryValidationError('Subject must not exceed 200 characters');
    }

    if (!inquiryData.message || inquiryData.message.trim().length === 0) {
      throw new InquiryValidationError('Message is required');
    }

    if (inquiryData.message.length > 2000) {
      throw new InquiryValidationError('Message must not exceed 2000 characters');
    }

    const query = `
      INSERT INTO user_inquiries (user_id, subject, message, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `;

    const values = [
      inquiryData.user_id,
      inquiryData.subject.trim(),
      inquiryData.message.trim(),
    ];

    const result = await db.query(query, values);
    return keysToCamelCase<UserInquiry>(result.rows[0]);
  }

  async getUserInquiries(userId: string): Promise<UserInquiry[]> {
    const db = getDatabaseService();

    const query = `
      SELECT * FROM user_inquiries
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows.map(row => keysToCamelCase<UserInquiry>(row));
  }

  async getInquiryById(inquiryId: number): Promise<UserInquiry | null> {
    const db = getDatabaseService();

    const query = `SELECT * FROM user_inquiries WHERE inquiry_id = $1`;
    const result = await db.query(query, [inquiryId]);

    if (result.rows.length === 0) return null;
    return keysToCamelCase<UserInquiry>(result.rows[0]);
  }

  async updateInquiryStatus(
    inquiryId: number,
    status: 'pending' | 'answered' | 'closed',
    response?: string
  ): Promise<UserInquiry> {
    const db = getDatabaseService();

    const query = `
      UPDATE user_inquiries
      SET status = $1,
          response = $2,
          answered_at = CASE WHEN $1 = 'answered' THEN CURRENT_TIMESTAMP ELSE answered_at END
      WHERE inquiry_id = $3
      RETURNING *
    `;

    const result = await db.query(query, [status, response || null, inquiryId]);

    if (result.rows.length === 0) {
      throw new Error(`Inquiry not found: ${inquiryId}`);
    }

    return keysToCamelCase<UserInquiry>(result.rows[0]);
  }

  async getPendingInquiries(limit: number = 50, offset: number = 0): Promise<UserInquiry[]> {
    const db = getDatabaseService();

    const query = `
      SELECT * FROM user_inquiries
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);
    return result.rows.map(row => keysToCamelCase<UserInquiry>(row));
  }

  async getInquiryCountForUser(userId: string): Promise<number> {
    const db = getDatabaseService();
    const query = `SELECT COUNT(*) as count FROM user_inquiries WHERE user_id = $1`;
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count, 10);
  }
}

let inquiryServiceInstance: InquiryService | null = null;

export function getInquiryService(): InquiryService {
  if (!inquiryServiceInstance) {
    inquiryServiceInstance = new InquiryService();
  }
  return inquiryServiceInstance;
}
