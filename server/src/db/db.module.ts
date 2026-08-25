import { Module } from '@nestjs/common';
import { DbService } from './db.service';

@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}

// ⚠️ One important issue with your current migration approach

// We're keeping your migrations exactly as requested, but there is a limitation in the current implementation.

// Every time you restart Nest:

// npm run dev

// this runs:

// 001
// 002
// 003
// 004

// again.

// If your SQL uses:

// CREATE TABLE IF NOT EXISTS

// then you're probably okay.

// But a real migration system normally tracks:

// 001 → already executed
// 002 → already executed
// 003 → already executed
// 004 → already executed

// and only executes new migrations.

// Don't worry about that yet. Since you're learning the Nest architecture, we'll first get the database connection and migration runner working.

// After that, I strongly recommend we make a tiny schema_migrations table and implement proper migration tracking ourselves. That will actually be a nice little backend exercise and avoid bringing in a migration ORM just for this project.
