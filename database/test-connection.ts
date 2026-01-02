/**
 * Database Connection Test Script
 * 
 * Run this script to test the database connection and verify setup.
 * 
 * Usage:
 *   ts-node database/test-connection.ts
 */

import dotenv from 'dotenv';
import { DatabaseService, createDatabaseConfig } from '../src/services/database';

// Load environment variables from .env file
dotenv.config({ override: true });

async function testDatabaseConnection() {
  console.log('=== Database Connection Test ===\n');

  // Debug: Print environment variables
  console.log('Environment Variables (from process.env):');
  console.log(`  DB_HOST: ${process.env.DB_HOST}`);
  console.log(`  DB_PORT: ${process.env.DB_PORT}`);
  console.log(`  DB_NAME: ${process.env.DB_NAME}`);
  console.log(`  DB_USER: ${process.env.DB_USER}`);
  console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' : 'undefined'}\n`);

  // Create database service
  const config = createDatabaseConfig();
  console.log('Database Configuration:');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Max Connections: ${config.max}`);
  console.log(`  Idle Timeout: ${config.idleTimeoutMillis}ms`);
  console.log(`  Connection Timeout: ${config.connectionTimeoutMillis}ms\n`);

  const db = new DatabaseService(config);

  try {
    // Test connection
    console.log('Connecting to database...');
    await db.connect();
    console.log('✓ Connection successful!\n');

    // Test query
    console.log('Testing query execution...');
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✓ Query successful!');
    console.log(`  Current Time: ${result.rows[0].current_time}`);
    console.log(`  PostgreSQL Version: ${result.rows[0].pg_version}\n`);

    // Check if tables exist
    console.log('Checking for required tables...');
    const tablesResult = await db.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('users', 'user_profiles', 'user_reports', 'user_inquiries')
      ORDER BY tablename
    `);

    const existingTables = tablesResult.rows.map(row => row.tablename);
    const requiredTables = ['users', 'user_profiles', 'user_reports', 'user_inquiries'];

    console.log('Required tables:');
    for (const table of requiredTables) {
      const exists = existingTables.includes(table);
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    }

    if (existingTables.length === 0) {
      console.log('\n⚠ No tables found. Please run migrations first:');
      console.log('  psql -h <host> -U <user> -d <database> -f database/migrations/run_migrations.sql\n');
    } else if (existingTables.length < requiredTables.length) {
      console.log('\n⚠ Some tables are missing. Please run all migrations.\n');
    } else {
      console.log('\n✓ All required tables exist!\n');
    }

    // Get pool statistics
    const stats = db.getPoolStats();
    if (stats) {
      console.log('Connection Pool Statistics:');
      console.log(`  Total Connections: ${stats.totalCount}`);
      console.log(`  Idle Connections: ${stats.idleCount}`);
      console.log(`  Waiting Requests: ${stats.waitingCount}\n`);
    }

    console.log('=== Test Complete ===');
    console.log('✓ Database connection is working correctly!\n');

  } catch (error) {
    console.error('\n✗ Test failed:');
    console.error(error);
    process.exit(1);
  } finally {
    // Close connection
    await db.close();
    console.log('Connection closed.');
  }
}

// Run test
testDatabaseConnection().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
