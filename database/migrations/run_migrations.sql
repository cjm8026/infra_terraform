-- Master migration script for User Profile Management System
-- Run this script to create all tables and indexes in the correct order
-- Database: fproject_db
-- PostgreSQL version: 12+

-- Start transaction
BEGIN;

-- Migration 001: Create users table
\i 001_create_users_table.sql

-- Migration 002: Create user_profiles table
\i 002_create_user_profiles_table.sql

-- Migration 003: Create user_reports table
\i 003_create_user_reports_table.sql

-- Migration 004: Create user_inquiries table
\i 004_create_user_inquiries_table.sql

-- Commit transaction
COMMIT;

-- Display success message
SELECT 'All migrations completed successfully!' AS status;

-- Display table information
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'user_profiles', 'user_reports', 'user_inquiries')
ORDER BY tablename;
