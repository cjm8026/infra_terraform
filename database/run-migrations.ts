/**
 * Run Database Migrations Script
 * 
 * This script runs all database migrations in order.
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseService } from '../src/services/database';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ override: true });

async function runMigrations() {
  console.log('=== Running Database Migrations ===\n');

  const db = getDatabaseService();

  try {
    // Connect to database
    console.log('Connecting to database...');
    await db.connect();
    console.log('✓ Connected\n');

    // List of migration files in order
    const migrations = [
      '001_create_users_table.sql',
      '002_create_user_profiles_table.sql',
      '003_create_user_reports_table.sql',
      '004_create_user_inquiries_table.sql',
    ];

    // Run each migration
    for (const migrationFile of migrations) {
      console.log(`Running migration: ${migrationFile}`);
      
      const migrationPath = join(__dirname, 'migrations', migrationFile);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      try {
        await db.query(sql);
        console.log(`✓ ${migrationFile} completed\n`);
      } catch (error: any) {
        console.error(`✗ ${migrationFile} failed:`);
        console.error(error.message);
        throw error;
      }
    }

    console.log('=== All Migrations Completed Successfully! ===\n');

    // Verify tables were created
    console.log('Verifying tables...');
    const result = await db.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('users', 'user_profiles', 'user_reports', 'user_inquiries')
      ORDER BY tablename
    `);

    console.log('\nCreated tables:');
    result.rows.forEach((row: any) => {
      console.log(`  ✓ ${row.tablename}`);
    });

    console.log('\n✓ Migration verification complete!');

  } catch (error) {
    console.error('\n✗ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await db.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run migrations
runMigrations().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
