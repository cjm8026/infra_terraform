-- Rollback script for User Profile Management System
-- WARNING: This will delete all tables and data!
-- Use with caution, preferably only in development environments

-- Start transaction
BEGIN;

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS user_inquiries CASCADE;
DROP TABLE IF EXISTS user_reports CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Commit transaction
COMMIT;

-- Display success message
SELECT 'All tables and functions have been dropped successfully!' AS status;

-- Verify tables are gone
SELECT 
    schemaname,
    tablename
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'user_profiles', 'user_reports', 'user_inquiries');

-- If no rows returned, rollback was successful
