-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    profile_image_url TEXT,
    bio TEXT CHECK (LENGTH(bio) <= 500),
    phone_number VARCHAR(20),
    additional_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_profiles_user_id FOREIGN KEY (user_id) 
        REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE user_profiles IS 'Extended user profile information beyond Cognito data';
COMMENT ON COLUMN user_profiles.user_id IS 'Foreign key to users table (Cognito sub)';
COMMENT ON COLUMN user_profiles.profile_image_url IS 'URL to user profile image stored in S3 or similar';
COMMENT ON COLUMN user_profiles.bio IS 'User biography (max 500 characters)';
COMMENT ON COLUMN user_profiles.phone_number IS 'User phone number (optional)';
COMMENT ON COLUMN user_profiles.additional_info IS 'JSONB field for flexible additional data';
