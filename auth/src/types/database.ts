/**
 * Database Type Definitions
 */

export interface User {
  user_id: string;
  email: string;
  nickname: string;
  status: 'active' | 'inactive' | 'deleted';
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserProfile {
  profile_id: number;
  user_id: string;
  profile_image_url: string | null;
  bio: string | null;
  phone_number: string | null;
  additional_info: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserReport {
  report_id: number;
  reporter_id: string;
  reported_user_id: string;
  reason: 'spam' | 'harassment' | 'inappropriate_content' | 'other';
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: Date;
  reviewed_at: Date | null;
}

export interface UserInquiry {
  inquiry_id: number;
  user_id: string;
  subject: string;
  message: string;
  status: 'pending' | 'answered' | 'closed';
  response: string | null;
  created_at: Date;
  answered_at: Date | null;
}

export interface FullUserProfile {
  userId: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  bio: string | null;
  phoneNumber: string | null;
  status: 'active' | 'inactive' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  user_id: string;
  email: string;
  nickname: string;
  status?: 'active' | 'inactive' | 'deleted';
}

export interface UpdateUserProfileData {
  nickname?: string;
  profile_image_url?: string;
  bio?: string;
  phone_number?: string;
}

export interface CreateUserReportData {
  reporter_id: string;
  reported_user_id: string;
  reason: 'spam' | 'harassment' | 'inappropriate_content' | 'other';
  description?: string;
}

export interface CreateUserInquiryData {
  user_id: string;
  subject: string;
  message: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export enum DatabaseErrorCode {
  UNIQUE_VIOLATION = '23505',
  FOREIGN_KEY_VIOLATION = '23503',
  NOT_NULL_VIOLATION = '23502',
  CHECK_VIOLATION = '23514',
  SYNTAX_ERROR = '42601',
  INSUFFICIENT_PRIVILEGE = '42501',
  UNDEFINED_TABLE = '42P01',
}

export interface DatabaseError extends Error {
  code?: string;
  detail?: string;
  table?: string;
  constraint?: string;
}
