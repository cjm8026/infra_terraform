-- Create user_inquiries table
CREATE TABLE IF NOT EXISTS user_inquiries (
    inquiry_id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT CHECK (LENGTH(message) <= 2000) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
    response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP NULL,
    CONSTRAINT fk_user_inquiries_user_id FOREIGN KEY (user_id) 
        REFERENCES users(user_id)
);

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_user_inquiries_user_id ON user_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inquiries_status ON user_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_user_inquiries_created_at ON user_inquiries(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE user_inquiries IS 'User inquiries and support tickets';
COMMENT ON COLUMN user_inquiries.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN user_inquiries.subject IS 'Inquiry subject line (max 200 characters)';
COMMENT ON COLUMN user_inquiries.message IS 'Inquiry message content (max 2000 characters)';
COMMENT ON COLUMN user_inquiries.status IS 'Inquiry status: pending, answered, or closed';
COMMENT ON COLUMN user_inquiries.response IS 'Admin response to the inquiry';
COMMENT ON COLUMN user_inquiries.answered_at IS 'Timestamp when inquiry was answered';
