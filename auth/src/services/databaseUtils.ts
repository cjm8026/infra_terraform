/**
 * Database Utility Functions
 */

import { QueryResult } from 'pg';

export function buildWhereClause(
  conditions: Record<string, any>,
  startIndex: number = 1
): { clause: string; values: any[] } {
  const entries = Object.entries(conditions).filter(([_, value]) => value !== undefined);
  
  if (entries.length === 0) {
    return { clause: '', values: [] };
  }

  const clauses = entries.map(([key], index) => `${key} = $${startIndex + index}`);
  const values = entries.map(([_, value]) => value);

  return {
    clause: `WHERE ${clauses.join(' AND ')}`,
    values,
  };
}

export function extractSingleRow<T>(result: QueryResult<T>): T | null {
  return result.rows.length > 0 ? result.rows[0] : null;
}

export function extractRows<T>(result: QueryResult<T>): T[] {
  return result.rows;
}

export function hasRows(result: QueryResult): boolean {
  return result.rowCount !== null && result.rowCount > 0;
}

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function keysToCamelCase<T = any>(obj: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = value;
  }
  return result as T;
}

export function keysToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    result[snakeKey] = value;
  }
  return result;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || phone.trim() === '') return true;
  const cleanPhone = phone.replace(/[\s-]/g, '');
  const phoneRegex = /^(\+?[1-9]\d{9,14}|0\d{9,10})$/;
  return phoneRegex.test(cleanPhone);
}

export function isValidNickname(nickname: string): boolean {
  const nicknameRegex = /^[가-힣a-zA-Z0-9_]{2,20}$/;
  return nicknameRegex.test(nickname);
}

export function isValidPassword(password: string): boolean {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export function createPaginationParams(
  page: number = 1,
  pageSize: number = 10
): PaginationParams {
  const limit = Math.max(1, Math.min(pageSize, 100));
  const offset = (Math.max(1, page) - 1) * limit;
  return { limit, offset };
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export function createPaginationResponse<T>(
  data: T[],
  totalItems: number,
  page: number,
  pageSize: number
): PaginationResponse<T> {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}
