/**
 * Database Service Basic Usage Examples
 * 
 * This file demonstrates how to use the database service for common operations.
 */

import { getDatabaseService, initializeDatabase } from '../../src/services/database';
import { buildWhereClause, buildUpdateClause, buildInsertClause } from '../../src/services/databaseUtils';
import type { User, UserProfile } from '../../src/types/database';

/**
 * Example 1: Initialize database connection
 */
async function example1_InitializeConnection() {
  console.log('=== Example 1: Initialize Connection ===\n');
  
  const db = await initializeDatabase();
  console.log('Database connected successfully!');
  
  // Get pool statistics
  const stats = db.getPoolStats();
  console.log('Pool stats:', stats);
  
  await db.close();
}

/**
 * Example 2: Simple query
 */
async function example2_SimpleQuery() {
  console.log('\n=== Example 2: Simple Query ===\n');
  
  const db = await initializeDatabase();
  
  // Query current time
  const result = await db.query('SELECT NOW() as current_time');
  console.log('Current time:', result.rows[0].current_time);
  
  await db.close();
}

/**
 * Example 3: Parameterized query
 */
async function example3_ParameterizedQuery() {
  console.log('\n=== Example 3: Parameterized Query ===\n');
  
  const db = await initializeDatabase();
  
  // Find user by email (parameterized to prevent SQL injection)
  const email = 'user@example.com';
  const result = await db.query<User>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  
  if (result.rows.length > 0) {
    console.log('User found:', result.rows[0]);
  } else {
    console.log('User not found');
  }
  
  await db.close();
}

/**
 * Example 4: Insert data
 */
async function example4_InsertData() {
  console.log('\n=== Example 4: Insert Data ===\n');
  
  const db = await initializeDatabase();
  
  // Insert new user
  const userData = {
    user_id: 'cognito-sub-123',
    email: 'newuser@example.com',
    nickname: 'newuser123',
    status: 'active'
  };
  
  const { columns, placeholders, values } = buildInsertClause(userData);
  
  const result = await db.query<User>(
    `INSERT INTO users (${columns}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  
  console.log('Inserted user:', result.rows[0]);
  
  await db.close();
}

/**
 * Example 5: Update data
 */
async function example5_UpdateData() {
  console.log('\n=== Example 5: Update Data ===\n');
  
  const db = await initializeDatabase();
  
  // Update user nickname
  const userId = 'cognito-sub-123';
  const updates = {
    nickname: 'updated_nickname',
    updated_at: new Date()
  };
  
  const { clause, values } = buildUpdateClause(updates);
  
  const result = await db.query<User>(
    `UPDATE users ${clause} WHERE user_id = $${values.length + 1} RETURNING *`,
    [...values, userId]
  );
  
  if (result.rows.length > 0) {
    console.log('Updated user:', result.rows[0]);
  }
  
  await db.close();
}

/**
 * Example 6: Transaction
 */
async function example6_Transaction() {
  console.log('\n=== Example 6: Transaction ===\n');
  
  const db = await initializeDatabase();
  
  try {
    const result = await db.transaction(async (client) => {
      // Insert user
      const userResult = await client.query<User>(
        `INSERT INTO users (user_id, email, nickname) 
         VALUES ($1, $2, $3) RETURNING *`,
        ['cognito-sub-456', 'transaction@example.com', 'txuser']
      );
      
      const user = userResult.rows[0];
      
      // Insert user profile
      const profileResult = await client.query<UserProfile>(
        `INSERT INTO user_profiles (user_id, bio) 
         VALUES ($1, $2) RETURNING *`,
        [user.user_id, 'Created via transaction']
      );
      
      return {
        user: user,
        profile: profileResult.rows[0]
      };
    });
    
    console.log('Transaction successful!');
    console.log('User:', result.user);
    console.log('Profile:', result.profile);
    
  } catch (error) {
    console.error('Transaction failed:', error);
  }
  
  await db.close();
}

/**
 * Example 7: Complex query with WHERE clause
 */
async function example7_ComplexQuery() {
  console.log('\n=== Example 7: Complex Query ===\n');
  
  const db = await initializeDatabase();
  
  // Find active users with specific criteria
  const conditions = {
    status: 'active'
  };
  
  const { clause, values } = buildWhereClause(conditions);
  
  const result = await db.query<User>(
    `SELECT * FROM users ${clause} ORDER BY created_at DESC LIMIT 10`,
    values
  );
  
  console.log(`Found ${result.rows.length} active users`);
  result.rows.forEach(user => {
    console.log(`- ${user.nickname} (${user.email})`);
  });
  
  await db.close();
}

/**
 * Example 8: Join query
 */
async function example8_JoinQuery() {
  console.log('\n=== Example 8: Join Query ===\n');
  
  const db = await initializeDatabase();
  
  // Get user with profile
  const userId = 'cognito-sub-123';
  
  const result = await db.query(`
    SELECT 
      u.user_id,
      u.email,
      u.nickname,
      u.status,
      u.created_at,
      u.updated_at,
      p.profile_image_url,
      p.bio,
      p.phone_number
    FROM users u
    LEFT JOIN user_profiles p ON u.user_id = p.user_id
    WHERE u.user_id = $1
  `, [userId]);
  
  if (result.rows.length > 0) {
    console.log('User with profile:', result.rows[0]);
  }
  
  await db.close();
}

/**
 * Example 9: Error handling
 */
async function example9_ErrorHandling() {
  console.log('\n=== Example 9: Error Handling ===\n');
  
  const db = await initializeDatabase();
  
  try {
    // Try to insert duplicate email (will fail due to unique constraint)
    await db.query(
      `INSERT INTO users (user_id, email, nickname) VALUES ($1, $2, $3)`,
      ['test-id', 'existing@example.com', 'testuser']
    );
  } catch (error: any) {
    console.log('Caught expected error:');
    console.log('- Code:', error.code);
    console.log('- Message:', error.message);
    
    if (error.code === '23505') {
      console.log('This is a unique constraint violation');
    }
  }
  
  await db.close();
}

/**
 * Example 10: Pagination
 */
async function example10_Pagination() {
  console.log('\n=== Example 10: Pagination ===\n');
  
  const db = await initializeDatabase();
  
  const page = 1;
  const pageSize = 10;
  const offset = (page - 1) * pageSize;
  
  // Get paginated users
  const result = await db.query<User>(
    `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  
  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM users`
  );
  
  const totalItems = parseInt(countResult.rows[0].total);
  const totalPages = Math.ceil(totalItems / pageSize);
  
  console.log(`Page ${page} of ${totalPages}`);
  console.log(`Showing ${result.rows.length} of ${totalItems} users`);
  
  await db.close();
}

// Run examples
async function runExamples() {
  try {
    // Uncomment the examples you want to run
    
    // await example1_InitializeConnection();
    // await example2_SimpleQuery();
    // await example3_ParameterizedQuery();
    // await example4_InsertData();
    // await example5_UpdateData();
    // await example6_Transaction();
    // await example7_ComplexQuery();
    // await example8_JoinQuery();
    // await example9_ErrorHandling();
    // await example10_Pagination();
    
    console.log('\n=== All Examples Complete ===\n');
    
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use in other files
export {
  example1_InitializeConnection,
  example2_SimpleQuery,
  example3_ParameterizedQuery,
  example4_InsertData,
  example5_UpdateData,
  example6_Transaction,
  example7_ComplexQuery,
  example8_JoinQuery,
  example9_ErrorHandling,
  example10_Pagination,
};

// Run if executed directly
if (require.main === module) {
  runExamples();
}
