/**
 * Database Connection Service
 * 
 * Provides connection pooling and query execution for PostgreSQL database.
 * Implements retry logic with exponential backoff for connection failures.
 */

import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

export type QueryParams = any[];
export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

export class DatabaseService {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  public async connect(): Promise<void> {
    if (this.pool) {
      console.warn('Database pool already initialized');
      return;
    }

    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: this.config.max,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      ssl: this.config.ssl,
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    await this.testConnection();
    console.log('Database connection pool initialized successfully');
  }

  private async testConnection(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const client = await this.pool!.connect();
        await client.query('SELECT NOW()');
        client.release();
        console.log('Database connection test successful');
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`Connection attempt ${attempt} failed:`, error);

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Failed to connect to database after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  public async query<T = any>(
    sql: string,
    params: QueryParams = []
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.pool.query<T>(sql, params);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`Query attempt ${attempt} failed:`, error);

        if (this.isNonRetryableError(error as Error)) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying query in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Query failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  public async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Database connection pool closed');
    }
  }

  public getPoolStats() {
    if (!this.pool) return null;
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  private isNonRetryableError(error: Error): boolean {
    const nonRetryableCodes = [
      '23505', '23503', '23502', '23514', '42601', '42501', '42P01',
    ];
    const pgError = error as any;
    return nonRetryableCodes.includes(pgError.code);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createDatabaseConfig(): DatabaseConfig {
  // Debug: Log password length (not the actual password)
  console.log('[DB Config] DB_PASSWORD length:', process.env.DB_PASSWORD?.length || 0);
  console.log('[DB Config] DB_PASSWORD first char:', process.env.DB_PASSWORD?.charAt(0) || 'empty');
  
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'fproject_db',
    user: process.env.DB_USER || 'fproject_user',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  };

  if (process.env.NODE_ENV === 'production') {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

let dbInstance: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!dbInstance) {
    const config = createDatabaseConfig();
    dbInstance = new DatabaseService(config);
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<DatabaseService> {
  const db = getDatabaseService();
  await db.connect();
  return db;
}

export async function closeDatabaseConnection(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
