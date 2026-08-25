import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);

  private readonly pool: Pool;

  private readonly migrationFiles = [
    '001_create_files.sql',
    '002_create_jobs.sql',
    '003_create_file_rows.sql',
    '004_convert_timestamps_to_timestamptz.sql',
  ];

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.getOrThrow<string>('POSTGRES_HOST'),

      port: this.configService.getOrThrow<number>('POSTGRES_PORT'),

      user: this.configService.getOrThrow<string>('POSTGRES_USER'),

      password: this.configService.getOrThrow<string>('POSTGRES_PASSWORD'),

      database: this.configService.getOrThrow<string>('POSTGRES_DB'),
    });

    this.pool.on('error', (error) => {
      this.logger.error(`Unexpected PostgreSQL pool error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.initializeDatabase();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();

    this.logger.log('PostgreSQL connection pool closed.');
  }

  private async initializeDatabase(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      for (const migrationFile of this.migrationFiles) {
        const migrationPath = join(
          process.cwd(),
          'src',
          'db',
          'migrations',
          migrationFile,
        );

        const sql = await readFile(migrationPath, 'utf8');

        await client.query(sql);

        this.logger.log(`Migration executed: ${migrationFile}`);
      }

      await client.query('COMMIT');

      this.logger.log('Database initialized successfully.');
    } catch (error) {
      await client.query('ROLLBACK');

      this.logger.error('Database initialization failed.');

      throw error;
    } finally {
      client.release();
    }
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
