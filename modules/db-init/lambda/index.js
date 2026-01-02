const { Client } = require('pg');

exports.handler = async (event, context) => {
  // Lambda 연결 재사용 방지
  context.callbackWaitsForEmptyEventLoop = false;

  const dbConfig = {
    host: process.env.DB_HOST?.split(':')[0], // 포트 제거
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 30000,
  };

  const client = new Client(dbConfig);

  try {
    console.log(`Connecting to database: ${dbConfig.database} at ${dbConfig.host}`);
    await client.connect();
    console.log('Connected successfully');

    // 트랜잭션 시작
    await client.query('BEGIN');

    // =========================================================================
    // Migration 001: Create users table
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        nickname VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      );
    `);
    console.log('Created users table');

    // Users 인덱스
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);');
    console.log('Created users indexes');

    // updated_at 자동 업데이트 함수
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('Created update_updated_at_column function');

    // Users 트리거
    await client.query('DROP TRIGGER IF EXISTS update_users_updated_at ON users;');
    await client.query(`
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('Created users trigger');

    // Users 테이블 코멘트
    await client.query("COMMENT ON TABLE users IS 'Main users table synchronized with AWS Cognito';");
    await client.query("COMMENT ON COLUMN users.user_id IS 'Cognito sub (unique identifier from Cognito)';");
    await client.query("COMMENT ON COLUMN users.email IS 'User email address (unique)';");
    await client.query("COMMENT ON COLUMN users.nickname IS 'User nickname (unique, 2-20 characters)';");
    await client.query("COMMENT ON COLUMN users.status IS 'User account status: active, inactive, or deleted';");
    await client.query("COMMENT ON COLUMN users.deleted_at IS 'Timestamp when user was soft-deleted (NULL if active)';");

    // =========================================================================
    // Migration 002: Create user_profiles table
    // =========================================================================
    await client.query(`
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
    `);
    console.log('Created user_profiles table');

    await client.query('CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);');
    console.log('Created user_profiles indexes');

    await client.query('DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;');
    await client.query(`
      CREATE TRIGGER update_user_profiles_updated_at 
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('Created user_profiles trigger');

    await client.query("COMMENT ON TABLE user_profiles IS 'Extended user profile information beyond Cognito data';");
    await client.query("COMMENT ON COLUMN user_profiles.profile_image_url IS 'URL to user profile image stored in S3';");
    await client.query("COMMENT ON COLUMN user_profiles.bio IS 'User biography (max 500 characters)';");
    await client.query("COMMENT ON COLUMN user_profiles.additional_info IS 'JSONB field for flexible additional data';");

    // =========================================================================
    // Migration 003: Create user_reports table
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_reports (
        report_id SERIAL PRIMARY KEY,
        reporter_id VARCHAR(255) NOT NULL,
        reported_user_id VARCHAR(255) NOT NULL,
        reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate_content', 'other')),
        description TEXT CHECK (LENGTH(description) <= 1000),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP NULL,
        CONSTRAINT fk_user_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(user_id),
        CONSTRAINT fk_user_reports_reported FOREIGN KEY (reported_user_id) REFERENCES users(user_id),
        CONSTRAINT different_users CHECK (reporter_id != reported_user_id)
      );
    `);
    console.log('Created user_reports table');

    await client.query('CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at);');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_reports_duplicate_check 
        ON user_reports(reporter_id, reported_user_id, created_at);
    `);
    console.log('Created user_reports indexes');

    await client.query("COMMENT ON TABLE user_reports IS 'User reports for inappropriate behavior or content';");
    await client.query("COMMENT ON COLUMN user_reports.reason IS 'Category: spam, harassment, inappropriate_content, or other';");
    await client.query("COMMENT ON COLUMN user_reports.status IS 'Report status: pending, reviewed, or resolved';");

    // =========================================================================
    // Migration 004: Create user_inquiries table
    // =========================================================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_inquiries (
        inquiry_id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        message TEXT CHECK (LENGTH(message) <= 2000) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
        response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        answered_at TIMESTAMP NULL,
        CONSTRAINT fk_user_inquiries_user_id FOREIGN KEY (user_id) REFERENCES users(user_id)
      );
    `);
    console.log('Created user_inquiries table');

    await client.query('CREATE INDEX IF NOT EXISTS idx_user_inquiries_user_id ON user_inquiries(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_inquiries_status ON user_inquiries(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_inquiries_created_at ON user_inquiries(created_at DESC);');
    console.log('Created user_inquiries indexes');

    await client.query("COMMENT ON TABLE user_inquiries IS 'User inquiries and support tickets';");
    await client.query("COMMENT ON COLUMN user_inquiries.status IS 'Inquiry status: pending, answered, or closed';");

    // 트랜잭션 커밋
    await client.query('COMMIT');
    console.log('All migrations committed successfully');

    // 생성된 테이블 확인
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tables = tablesResult.rows.map(row => row.table_name);

    console.log('Tables created:', tables);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'All tables created successfully',
        tables,
        database: dbConfig.database,
        host: dbConfig.host
      })
    };

  } catch (error) {
    console.error('Database error:', error);
    
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Database error',
        message: error.message
      })
    };

  } finally {
    try {
      await client.end();
      console.log('Database connection closed');
    } catch (endError) {
      console.error('Error closing connection:', endError);
    }
  }
};