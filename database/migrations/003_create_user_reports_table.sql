-- Create user_reports table
CREATE TABLE IF NOT EXISTS user_reports (
    report_id SERIAL PRIMARY KEY,
    reporter_id VARCHAR(255) NOT NULL,
    reported_user_id VARCHAR(255) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate_content', 'other')),
    description TEXT CHECK (LENGTH(description) <= 1000),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    CONSTRAINT fk_user_reports_reporter FOREIGN KEY (reporter_id) 
        REFERENCES users(user_id),
    CONSTRAINT fk_user_reports_reported FOREIGN KEY (reported_user_id) 
        REFERENCES users(user_id),
    CONSTRAINT different_users CHECK (reporter_id != reported_user_id)
);

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at);

-- Create composite index for duplicate report checking (within 24 hours)
CREATE INDEX IF NOT EXISTS idx_user_reports_duplicate_check 
    ON user_reports(reporter_id, reported_user_id, created_at);

-- Add comments for documentation
COMMENT ON TABLE user_reports IS 'User reports for inappropriate behavior or content';
COMMENT ON COLUMN user_reports.reporter_id IS 'User ID of the person submitting the report';
COMMENT ON COLUMN user_reports.reported_user_id IS 'User ID of the person being reported';
COMMENT ON COLUMN user_reports.reason IS 'Category of the report: spam, harassment, inappropriate_content, or other';
COMMENT ON COLUMN user_reports.description IS 'Optional detailed description (max 1000 characters)';
COMMENT ON COLUMN user_reports.status IS 'Report status: pending, reviewed, or resolved';
COMMENT ON COLUMN user_reports.reviewed_at IS 'Timestamp when report was reviewed by admin';
COMMENT ON CONSTRAINT different_users ON user_reports IS 'Ensures users cannot report themselves';
