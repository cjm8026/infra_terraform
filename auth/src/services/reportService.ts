/**
 * Report Service Module
 */

import { getDatabaseService } from './database';
import { keysToCamelCase } from './databaseUtils';
import type { UserReport, CreateUserReportData } from '../types/database';

export type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'other';

export const VALID_REPORT_REASONS: ReportReason[] = [
  'spam', 'harassment', 'inappropriate_content', 'other',
];

export class SelfReportError extends Error {
  constructor() {
    super('Users cannot report themselves');
    this.name = 'SelfReportError';
  }
}

export class DuplicateReportError extends Error {
  constructor() {
    super('A report for this user already exists within the last 24 hours');
    this.name = 'DuplicateReportError';
  }
}

export class InvalidReportReasonError extends Error {
  constructor(reason: string) {
    super(`Invalid report reason: ${reason}. Must be one of: ${VALID_REPORT_REASONS.join(', ')}`);
    this.name = 'InvalidReportReasonError';
  }
}

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationError';
  }
}

export class ReportService {
  async createReport(reportData: CreateUserReportData): Promise<UserReport> {
    const db = getDatabaseService();

    if (reportData.reporter_id === reportData.reported_user_id) {
      throw new SelfReportError();
    }

    if (!VALID_REPORT_REASONS.includes(reportData.reason as ReportReason)) {
      throw new InvalidReportReasonError(reportData.reason);
    }

    if (reportData.description && reportData.description.length > 1000) {
      throw new ReportValidationError('Description must not exceed 1000 characters');
    }

    const hasDuplicate = await this.checkDuplicateReport(
      reportData.reporter_id,
      reportData.reported_user_id
    );

    if (hasDuplicate) {
      throw new DuplicateReportError();
    }

    const query = `
      INSERT INTO user_reports (reporter_id, reported_user_id, reason, description, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING *
    `;

    const values = [
      reportData.reporter_id,
      reportData.reported_user_id,
      reportData.reason,
      reportData.description || null,
    ];

    const result = await db.query(query, values);
    return keysToCamelCase<UserReport>(result.rows[0]);
  }

  async checkDuplicateReport(reporterId: string, reportedUserId: string): Promise<boolean> {
    const db = getDatabaseService();

    const query = `
      SELECT report_id FROM user_reports
      WHERE reporter_id = $1
        AND reported_user_id = $2
        AND status = 'pending'
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `;

    const result = await db.query(query, [reporterId, reportedUserId]);
    return result.rows.length > 0;
  }

  async getReportsByReporter(reporterId: string): Promise<UserReport[]> {
    const db = getDatabaseService();
    const query = `SELECT * FROM user_reports WHERE reporter_id = $1 ORDER BY created_at DESC`;
    const result = await db.query(query, [reporterId]);
    return result.rows.map(row => keysToCamelCase<UserReport>(row));
  }

  async getReportsForUser(reportedUserId: string): Promise<UserReport[]> {
    const db = getDatabaseService();
    const query = `SELECT * FROM user_reports WHERE reported_user_id = $1 ORDER BY created_at DESC`;
    const result = await db.query(query, [reportedUserId]);
    return result.rows.map(row => keysToCamelCase<UserReport>(row));
  }

  async getReportById(reportId: number): Promise<UserReport | null> {
    const db = getDatabaseService();
    const query = `SELECT * FROM user_reports WHERE report_id = $1`;
    const result = await db.query(query, [reportId]);
    if (result.rows.length === 0) return null;
    return keysToCamelCase<UserReport>(result.rows[0]);
  }

  async updateReportStatus(
    reportId: number,
    status: 'pending' | 'reviewed' | 'resolved'
  ): Promise<UserReport> {
    const db = getDatabaseService();

    const query = `
      UPDATE user_reports
      SET status = $1, reviewed_at = CURRENT_TIMESTAMP
      WHERE report_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [status, reportId]);

    if (result.rows.length === 0) {
      throw new Error(`Report not found: ${reportId}`);
    }

    return keysToCamelCase<UserReport>(result.rows[0]);
  }

  async getPendingReports(limit: number = 50, offset: number = 0): Promise<UserReport[]> {
    const db = getDatabaseService();
    const query = `
      SELECT * FROM user_reports
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await db.query(query, [limit, offset]);
    return result.rows.map(row => keysToCamelCase<UserReport>(row));
  }

  async getReportCountForUser(reportedUserId: string): Promise<number> {
    const db = getDatabaseService();
    const query = `SELECT COUNT(*) as count FROM user_reports WHERE reported_user_id = $1`;
    const result = await db.query(query, [reportedUserId]);
    return parseInt(result.rows[0].count, 10);
  }
}

let reportServiceInstance: ReportService | null = null;

export function getReportService(): ReportService {
  if (!reportServiceInstance) {
    reportServiceInstance = new ReportService();
  }
  return reportServiceInstance;
}
