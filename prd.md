# TaskFlow — Distributed CSV Processing Job Queue

## 1. Project Overview

### Project Name

**TaskFlow**

### Project Type

Mini distributed background-job processing system.

### Primary Use Case

Users upload CSV files through a React web application.

The API does **not process the CSV synchronously**.

Instead:

1. User uploads CSV.
2. API stores the uploaded file.
3. API creates a processing job.
4. Job is pushed into Redis Streams.
5. API immediately responds with the job ID.
6. Background worker consumes the job.
7. Worker processes the CSV.
8. Worker stores the processed rows.
9. Worker updates job status.
10. React dashboard displays processing progress/status.
11. User can open completed files and view the data in a table.
12. User can download the original CSV.

The system intentionally has **no authentication, authorization, payments, multi-tenancy, or advanced UI**.

The goal is to demonstrate distributed-system concepts rather than build a production SaaS application.

---

# 2. Primary Learning Objectives

The project should help demonstrate understanding of:

* Background jobs
* Message queues
* Redis Streams
* Producer/consumer architecture
* Worker processes
* Asynchronous processing
* Job lifecycle
* At-least-once delivery
* Retry mechanisms
* Exponential backoff
* Idempotency
* Dead-letter handling
* Worker concurrency
* Backpressure
* Failure recovery
* Job status tracking
* Scheduled retry
* Database persistence
* Graceful worker shutdown
* Horizontal worker scaling

The implementation should remain intentionally simple.

Do not introduce unnecessary infrastructure.

---

# 3. Important Implementation Philosophy

The project should prioritize **understanding over feature count**.

Do NOT add:

* Authentication
* User accounts
* JWT
* OAuth
* Admin roles
* Payments
* Kubernetes
* Kafka
* Microservices for every component
* GraphQL
* WebSockets
* S3 initially
* Complex UI
* Complex CSS
* File sharing
* Team collaboration

The important architecture is:

```text
React
   |
   v
Node.js API
   |
   +---------> PostgreSQL
   |
   v
Redis Streams
   |
   +-------- Worker 1
   |
   +-------- Worker 2
   |
   +-------- Worker 3
              |
              v
          PostgreSQL
```

---

# 4. Recommended Technology Stack

## Frontend

* React
* Vite
* TypeScript
* Basic CSS
* axios 

## Backend

* Node.js
* TypeScript
* Express.js

## Queue

* Redis Streams

## Database

* PostgreSQL

## CSV Processing

Use a popular Node.js CSV parsing library.

Recommended:

```text
csv-parse
```

## File Storage

### Version 1

Local filesystem.

Example:

```text
storage/
  uploads/
  processed/
```

UPDATE - added S3 using docker minio for local testing. postgres and redis are also dockerized for local testing. integrate them also do not waste time on local storage. 

### Version 2

Replace local storage with S3-compatible object storage.

---

# 5. Free Infrastructure

The project should be completely free for development.

## Recommended Option

Run Redis and PostgreSQL using Docker.

This avoids needing cloud credentials.

Example architecture:

```text
Docker
 |
 +-- PostgreSQL
 |
 +-- Redis
```

The application itself runs locally:

```text
React
Node API
Worker
```

This is the preferred setup for this learning project.

## Redis

Use Redis through Docker.

Example environment variable:

```env
REDIS_URL=redis://localhost:6379
```

No Redis cloud account is required.

## PostgreSQL

Use PostgreSQL through Docker.

Example:

```env
DATABASE_URL=postgresql://taskflow:taskflow@localhost:5432/taskflow
```

No PostgreSQL cloud account is required.

## Object Storage

require S3 credentials in Version 1.


Use:

```env
STORAGE_TYPE=local
UPLOAD_DIR=./storage/uploads
```
skip local storage and use minio for s3 compatible object storage now.

---

# 6. Repository Structure

Use a simple monorepo.

```text
taskflow/
│
├── server/
│   ├── migrations/
│   ├── src/
│   │   ├── repositories/
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── worker/
│   ├── src/
│   │   ├── lib/
│   │   ├── repositories/
│   │   └── worker.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── ui/
│   ├── src/
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
├── constants/
│   └── customers.csv
│
├── docker-compose.yml
├── .gitignore
├── README.md
└── package.json
```

Do not over-engineer the folder structure if it creates unnecessary complexity.

---

# 7. Environment Variables

Create `.env.example` files from the beginning.

Never hardcode credentials.

## API

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=

REDIS_URL=

UPLOAD_DIR=./storage/uploads
PROCESSED_DIR=./storage/processed

REDIS_STREAM_KEY=taskflow:jobs
REDIS_CONSUMER_GROUP=taskflow-workers

MAX_FILE_SIZE_MB=20
```

## Worker

```env
NODE_ENV=development

DATABASE_URL=

REDIS_URL=

REDIS_STREAM_KEY=taskflow:jobs
REDIS_CONSUMER_GROUP=taskflow-workers
REDIS_CONSUMER_NAME=

MAX_CONCURRENCY=2
MAX_RETRIES=3
```

## Frontend

```env
VITE_API_URL=http://localhost:4000
```

Do not commit actual `.env` files.

Only commit `.env.example`.

---

# 8. Database Design

Use PostgreSQL.

Only two primary tables are required.

## files

```text
files
-----
id UUID PRIMARY KEY
original_name VARCHAR
stored_path VARCHAR
mime_type VARCHAR
size_bytes BIGINT
status VARCHAR
created_at TIMESTAMP
updated_at TIMESTAMP
```

Possible status values:

```text
UPLOADED
PROCESSING
COMPLETED
FAILED
```

## jobs

```text
jobs
----
id UUID PRIMARY KEY
file_id UUID
status VARCHAR
attempts INTEGER
max_attempts INTEGER
error_message TEXT
started_at TIMESTAMP
completed_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

Relationship:

```text
files 1 ---- N jobs
```

Although Version 1 normally creates one processing job per file, keeping the relationship separate makes the queue architecture easier to explain.

---

# 9. Job Status Lifecycle

The job lifecycle should be:

```text
QUEUED
   |
   v
PROCESSING
   |
   +------> COMPLETED
   |
   +------> RETRY_WAITING
   |
   +------> FAILED
```

A retry should return to:

```text
RETRY_WAITING
      |
      v
QUEUED
      |
      v
PROCESSING
```

---

# 10. File Processing Scenario

The only supported job type in Version 1 is:

```text
CSV_PROCESS
```

Example job payload:

```json
{
  "jobId": "job-123",
  "fileId": "file-123",
  "type": "CSV_PROCESS"
}
```

Do not create multiple job types yet.

---

# 11. CSV Upload Flow

User visits:

```text
/files
```

The UI contains:

```text
Upload CSV
```

User selects:

```text
customers.csv
```

Frontend sends:

```http
POST /api/files
Content-Type: multipart/form-data
```

Backend:

1. Validate file.
2. Validate extension.
3. Validate size.
4. Generate UUID.
5. Store file locally.
6. Create `files` record.
7. Create `jobs` record.
8. Push job into Redis Stream.
9. Return response immediately.

Example:

```json
{
  "fileId": "uuid",
  "jobId": "uuid",
  "status": "QUEUED"
}
```

The API must NOT process the CSV synchronously.

---

# 12. Redis Streams

Use Redis Streams.

Stream:

```text
taskflow:jobs
```

Consumer group:

```text
taskflow-workers
```

Workers use consumer names such as:

```text
worker-1
worker-2
worker-3
```

Example conceptual message:

```text
XADD taskflow:jobs *

jobId=<uuid>
fileId=<uuid>
type=CSV_PROCESS
```

---

# 13. Worker Architecture

Workers are independent Node.js processes.

Example:

```bash
npm run worker
```

Multiple workers can run simultaneously:

```text
Worker 1
Worker 2
Worker 3
```

All consume from:

```text
taskflow:jobs
```

Redis consumer groups distribute messages between workers.

The system should therefore demonstrate horizontal worker scaling.

---

# 14. Worker Processing Flow

Worker:

1. Reads job from Redis Stream.
2. Claims the message.
3. Reads job from PostgreSQL.
4. Checks current job status.
5. If already completed, acknowledge and stop.
6. Updates job status to `PROCESSING`.
7. Updates file status to `PROCESSING`.
8. Reads CSV file.
9. Parses CSV.
10. Stores rows.
11. Updates job to `COMPLETED`.
12. Updates file to `COMPLETED`.
13. Acknowledges Redis message.

---

# 15. CSV Data Storage

For this mini-project, store processed CSV data in PostgreSQL.

Use a generic table:

```text
file_rows
---------
id UUID PRIMARY KEY
file_id UUID
row_number INTEGER
data JSONB
created_at TIMESTAMP
```

Example:

```json
{
  "name": "John",
  "email": "john@example.com",
  "age": "31",
  "city": "Mumbai"
}
```

This allows different CSV column structures.

The database does not need a separate table for every CSV format.

---

# 16. Why JSONB?

The CSV columns are unknown.

For example:

```csv
name,email,age
John,john@example.com,31
```

Another file could be:

```csv
product,price,category
MacBook,150000,Laptop
```

Therefore:

```text
data JSONB
```

is appropriate for this learning project.

The schema stays fixed while the CSV columns vary.

---

# 17. CSV Processing Algorithm

Worker should:

```text
open file
   |
parse CSV
   |
for each row
   |
create file_rows record
   |
continue
```

For the first version, processing can be sequential.

Do not optimize prematurely.

Later, demonstrate batching:

```text
100 rows
   |
database insert
   |
next 100 rows
```

This provides a useful interview discussion around:

* Batch inserts
* Memory usage
* Database round trips
* Large CSV files

---

# 18. File List API

Endpoint:

```http
GET /api/files
```

Response:

```json
{
  "files": [
    {
      "id": "uuid",
      "name": "customers.csv",
      "size": 102400,
      "status": "COMPLETED",
      "createdAt": "2026-08-23T10:00:00Z"
    }
  ]
}
```

---

# 19. File Details API

Endpoint:

```http
GET /api/files/:fileId
```

Return:

```json
{
  "id": "uuid",
  "name": "customers.csv",
  "status": "COMPLETED",
  "job": {
    "id": "uuid",
    "status": "COMPLETED",
    "attempts": 1
  }
}
```

---

# 20. File Data API

Endpoint:

```http
GET /api/files/:fileId/rows
```

Support pagination.

Example:

```text
?page=1&limit=50
```

Response:

```json
{
  "rows": [
    {
      "id": "row-id",
      "rowNumber": 1,
      "data": {
        "name": "John",
        "email": "john@example.com"
      }
    }
  ],
  "page": 1,
  "limit": 50,
  "total": 1000
}
```

---

# 21. Download API

Endpoint:

```http
GET /api/files/:fileId/download
```

The API returns the original uploaded CSV.

---

# 22. Retry API

Endpoint:

```http
POST /api/jobs/:jobId/retry
```

This should only work for:

```text
FAILED
```

jobs.

The API:

1. Validates job.
2. Resets appropriate state.
3. Creates/requeues processing message.
4. Updates status to `QUEUED`.

---

# 23. React UI

The UI should be intentionally basic.

No fancy design is required.

Use simple CSS.

## Page 1 — Files Dashboard

```text
TaskFlow

[ Upload CSV ]

------------------------------------------------

File Name       Status       Created       Action

customers.csv   COMPLETED    Aug 23        View
orders.csv      PROCESSING   Aug 23        View
bad.csv         FAILED       Aug 23        Retry
```

---

# 24. Upload UI

Simple component:

```text
Upload CSV

[ Choose File ]

customers.csv

[ Upload ]
```

After upload:

```text
Upload successful.

Job queued.
```

---

# 25. File Details Page

Example:

```text
customers.csv

Status: COMPLETED

Rows: 1,250

[ Download CSV ]

------------------------------------------------

Name       Email              Age       City

John       john@example.com   31        Mumbai
Alex       alex@example.com   27        Pune
...
```

Pagination:

```text
< Previous    Page 1 of 25    Next >
```

---

# 26. Processing Status

The frontend should poll the API.

Example:

```text
GET /api/files/:fileId
```

Every few seconds while status is:

```text
QUEUED
PROCESSING
RETRY_WAITING
```

Stop polling when:

```text
COMPLETED
FAILED
```

Do not introduce WebSockets.

The goal is to keep the architecture simple.

---

# 27. Retry Strategy

Initial maximum retries:

```text
3
```

Example:

```text
Attempt 1
   |
failure
   |
wait 1 second
   |
Attempt 2
   |
failure
   |
wait 2 seconds
   |
Attempt 3
   |
failure
   |
FAILED
```

Formula:

```text
delay = baseDelay * 2^(attempt - 1)
```

Example:

```text
baseDelay = 1000ms

attempt 1 -> 1s
attempt 2 -> 2s
attempt 3 -> 4s
```

Optional jitter can be added later.

---

# 28. Retry Failure Handling

A worker should distinguish between:

### Retryable failure

Examples:

* Temporary database connection failure
* Temporary Redis issue
* Temporary filesystem failure

These should be retried.

### Non-retryable failure

Examples:

* Invalid CSV
* Corrupt file
* Unsupported file format

These can immediately become:

```text
FAILED
```

For the learning project, it is acceptable to keep the retry classification simple.

---

# 29. Dead-Letter Queue

Redis Streams do not need a separate complicated DLQ implementation for Version 1.

Represent permanently failed jobs using:

```text
FAILED
```

and retain:

```text
error_message
attempts
```

Later, optionally introduce:

```text
taskflow:dead-letter
```

For interviews, explain:

> A job that exceeds the retry limit should be moved to a dead-letter queue so that it can be investigated without continuously retrying it.

---

# 30. Idempotency

This is one of the most important concepts in the project.

Redis Streams provide at-least-once processing semantics.

Therefore a job may potentially be delivered more than once.

Example:

```text
Worker processes CSV
      |
      v
Database transaction succeeds
      |
Worker crashes before ACK
      |
Redis redelivers job
```

Without idempotency:

```text
CSV processed twice
```

To protect against this:

Before processing:

```text
Check job status.
```

If:

```text
COMPLETED
```

then:

```text
ACK message
DO NOT process again
```

Additionally, database constraints should help prevent duplicate row insertion.

---

# 31. Stronger Idempotency Design

Use:

```text
file_id + row_number
```

as a unique combination.

Database:

```text
UNIQUE(file_id, row_number)
```

Therefore even if processing repeats:

```text
file 123
row 50
```

cannot be inserted twice.

This is a very useful interview point.

---

# 32. Worker Concurrency

The worker should support:

```env
MAX_CONCURRENCY=2
```

Meaning one worker can process two jobs simultaneously.

Example:

```text
Worker 1

Job A -> processing
Job B -> processing
Job C -> waiting
Job D -> waiting
```

Do not allow unlimited concurrency.

Unlimited workers can overload:

* PostgreSQL
* CPU
* memory
* filesystem
* downstream APIs

---

# 33. Backpressure

Suppose users upload:

```text
1,000 CSV files
```

but only:

```text
3 workers
```

are running.

The jobs should remain queued.

The API should continue accepting jobs without trying to process them immediately.

This demonstrates:

```text
Producer faster than consumer
        |
        v
Queue absorbs temporary load
        |
        v
Workers process at controlled speed
```

---

# 34. Failure Scenario

The project must support a deliberate failure test.

Create a development-only option that can simulate worker failure.

Example:

```env
FAIL_PROCESSING=false
```

When enabled:

```text
Worker receives job
      |
      v
Processing fails
      |
      v
Retry
      |
      v
Retry
      |
      v
FAILED
```

This allows the queue behavior to be demonstrated during interviews.

---

# 35. Worker Crash Scenario

The worker should be killable during processing.

Example:

```text
Job A
 |
 v
PROCESSING
 |
Worker crashes
```

After worker restart, the system should be able to recover the pending/unacknowledged message.

The implementation should use Redis Stream consumer-group pending message mechanisms where appropriate.

This does not need to be perfect production-grade recovery.

The objective is to understand:

> What happens when a worker dies before acknowledging a message?

---

# 36. API Endpoints

Final Version 1 API:

```text
POST   /api/files
GET    /api/files
GET    /api/files/:fileId
GET    /api/files/:fileId/rows
GET    /api/files/:fileId/download

POST   /api/jobs/:jobId/retry

GET    /api/health
```

No authentication.

---

# 37. Health Check

Endpoint:

```http
GET /api/health
```

Response:

```json
{
  "status": "ok"
}
```

Later it may include:

```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

---

# 38. Dummy CSV Data

Create:

```text
sample-data/customers.csv
```

Example:

```csv
name,email,age,city,company
Rahul,rahul@example.com,28,Mumbai,Acme
Priya,priya@example.com,31,Pune,Globex
Amit,amit@example.com,26,Delhi,Initech
Neha,neha@example.com,29,Jaipur,Stark Industries
Rohan,rohan@example.com,35,Bangalore,Wayne Enterprises
```

Also create a larger development dataset:

```text
sample-data/customers-large.csv
```

with approximately:

```text
1,000 rows
```

This will be useful later for testing batching and performance.

---

# 39. Initial Database Migration

Create SQL migrations.

Example:

```text
migrations/
  001_create_files.sql
  002_create_jobs.sql
  003_create_file_rows.sql
```

Do not introduce Prisma/TypeORM unless there is a strong reason.

For this learning project, direct PostgreSQL queries are useful because they improve understanding of:

* SQL
* indexes
* transactions
* constraints
* JSONB
* batch inserts

The project should use parameterized SQL queries.

---

# 40. Required Database Indexes

Create indexes on:

```text
files.created_at
files.status

jobs.status
jobs.created_at
jobs.file_id

file_rows.file_id
```

Unique constraint:

```text
(file_id, row_number)
```

---

# 41. Transaction Boundary

CSV processing should use appropriate transactions.

For example:

```text
BEGIN

insert rows

update job COMPLETED

update file COMPLETED

COMMIT
```

If the transaction fails:

```text
ROLLBACK
```

Then the job can be retried.

Do not keep an extremely large transaction open for huge files in future versions.

For Version 1, reasonable batch transactions are acceptable.

---

# 42. Security Scope

No authentication is required.

However, basic safety should still exist:

* Validate file extension
* Validate MIME type where practical
* Limit upload size
* Never construct SQL from CSV content
* Use parameterized SQL
* Never trust filenames
* Generate server-side storage filenames
* Prevent path traversal

Example:

User uploads:

```text
../../malicious.csv
```

The server should NOT use the raw filename as the storage path.

Use:

```text
UUID + extension
```

instead.

---

# 43. Logging

API logs:

```text
file uploaded
job created
job queued
```

Worker logs:

```text
job received
job started
job completed
job failed
job retrying
```

Example:

```text
[worker-1] Job 123 received
[worker-1] Processing file 456
[worker-1] Job 123 completed
```

Keep logging simple.

No centralized logging system.

---

# 44. Error Handling

API should return consistent errors.

Example:

```json
{
  "error": {
    "code": "INVALID_FILE",
    "message": "Only CSV files are supported"
  }
}
```

Possible errors:

```text
INVALID_FILE
FILE_TOO_LARGE
FILE_NOT_FOUND
JOB_NOT_FOUND
JOB_NOT_RETRYABLE
PROCESSING_FAILED
INTERNAL_ERROR
```

---

# 45. Docker Compose

Docker Compose should initially run:

```text
postgres
redis
```

Example conceptual structure:

```yaml
services:

  postgres:
    image: postgres
    ports:
      - "5432:5432"

  redis:
    image: redis
    ports:
      - "6379:6379"
```

The API and worker can run directly from the host during development.

Later, Dockerize everything.

This makes debugging much easier.

---

# 46. Development Commands

Root commands should eventually support:

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
npm run db:up
npm run db:down
```

Optional:

```bash
npm run dev
```

to run everything concurrently.

---

# 47. Implementation Order

This is extremely important.

The AI coding agent must NOT attempt to implement everything at once.

Implement the project in the following phases.

---

# Phase 0 — Project Bootstrap

Tasks:

1. Create repository.
2. Initialize root package.json.
3. Create React Vite TypeScript app.
4. Create Node.js TypeScript API.
5. Create Node.js TypeScript worker.
6. Create basic shared package if necessary.
7. Create `.gitignore`.
8. Create `.env.example`.
9. Create README.
10. Verify all three applications start.

STOP.

Do not implement database or Redis yet.

---

# Phase 1 — Basic React UI

Build only:

```text
Files Dashboard
Upload CSV
File List
```

Use dummy JSON data.

Example:

```json
[
  {
    "id": "file-1",
    "name": "customers.csv",
    "status": "COMPLETED",
    "createdAt": "2026-08-23"
  },
  {
    "id": "file-2",
    "name": "orders.csv",
    "status": "PROCESSING",
    "createdAt": "2026-08-23"
  }
]
```

Requirements:

* Basic table
* Upload button
* File status badge
* View button
* Retry button
* Basic CSS
* No backend

STOP.

Verify UI works.

---

# Phase 2 — API Without Database

Create:

```text
GET /api/health
GET /api/files
POST /api/files
```

Use in-memory data temporarily.

React should call the API.

STOP.

Verify:

```text
React -> API
```

works.

---

# Phase 3 — PostgreSQL

Add Docker PostgreSQL.

Create:

```text
files
jobs
file_rows
```

tables.

Implement repository functions.

Replace in-memory file data.

STOP.

Verify:

```text
API -> PostgreSQL
```

works.

---

# Phase 4 — File Upload

<!-- Implement multipart upload.

Flow:

```text
React
 |
POST /files
 |
API
 |
save local file
 |
PostgreSQL
```

No Redis yet.

STOP.

Verify uploaded files appear in:

```text
storage/uploads
```

and PostgreSQL. -->
Now implement file upload with S3-compatible object storage (minio) instead of local storage. use signed URLs for upload/download. and save the file metadata in PostgreSQL using commented out code above.

---

# Phase 5 — Redis Connection

Add Redis Docker container.

Implement:

```text
Redis client
```

Add:

```text
REDIS_URL
```

Verify API can:

```text
PING
```

Redis.

STOP.

Do not implement workers yet.

---

# Phase 6 — Queue Producer

When file upload succeeds:

```text
PostgreSQL
      |
      v
Redis Stream
```

Add job:

```json
{
  "jobId": "...",
  "fileId": "...",
  "type": "CSV_PROCESS"
}
```

API should immediately respond.

STOP.

Verify messages exist in Redis.

---

# Phase 7 — Worker

Implement worker.

Worker should:

```text
read Redis Stream
      |
find job
      |
PROCESSING
      |
process CSV
      |
COMPLETED
```

STOP.

Test with one CSV.

---

# Phase 8 — CSV Processing

Implement:

```text
CSV parser
```

Store rows into:

```text
file_rows
```

Support:

```text
GET /files/:id/rows
```

STOP.

Verify data appears in UI.

---

# Phase 9 — File Details UI

Add:

```text
File Details
```

Display:

```text
Filename
Status
Rows
Created time
```

Then display rows in a table.

Add pagination.

STOP.

---

# Phase 10 — Download

Implement:

```text
GET /files/:id/download
```

Add:

```text
Download CSV
```

button.

STOP.

---

# Phase 11 — Retry

Implement:

```text
attempts
max_attempts
error_message
```

Implement exponential backoff.

Test using intentionally invalid CSV data or development failure mode.

STOP.

---

# Phase 12 — Idempotency

Implement:

```text
job status check
```

and:

```text
UNIQUE(file_id, row_number)
```

Test duplicate processing.

STOP.

---

# Phase 13 — Concurrency

Add:

```env
MAX_CONCURRENCY=2
```

Worker should process only the configured number of jobs simultaneously.

Test:

```text
5 uploaded files
```

with:

```text
MAX_CONCURRENCY=2
```

---

# Phase 14 — Failure Recovery

Test:

```text
Worker starts
Job starts
Worker is killed
Worker restarts
```

Verify pending work can be recovered.

Document the behavior.

---

# Phase 15 — Backpressure Demonstration

Upload:

```text
10 CSV files
```

Start:

```text
1 worker
```

Observe:

```text
QUEUED
PROCESSING
COMPLETED
```

Then start:

```text
3 workers
```

Observe throughput increase.

This is an important distributed-systems demonstration.

---

# Phase 16 — Polish

Only after all functionality works:

* Improve error messages
* Improve loading states
* Improve empty states
* Improve README
* Add architecture diagram
* Add failure scenarios

Do not spend significant time on visual design.

# Phase 17 - Dead-letter Queue
For dead-letter: not as a separate dead-letter queue/table yet. In the current project, failed jobs are handled as  FAILED  with retry attempts and error message tracking. Implement a separate dead-letter queue in Redis Streams for jobs that exceed the retry limit. This will allow for better investigation and handling of permanently failed jobs without cluttering the main job stream.

---

# 48. Definition of Done

The project is considered complete when this works:

```text
User
 |
 | Upload customers.csv
 v
React
 |
 v
Node API
 |
 +----> Local Storage
 |
 +----> PostgreSQL
 |
 +----> Redis Stream
              |
              v
           Worker
              |
              v
        Parse CSV
              |
              v
        PostgreSQL
              |
              v
          COMPLETED
              |
              v
          React UI
              |
              v
        Display Table
```

User must be able to:

* Upload CSV
* See queued status
* See processing status
* See completed status
* Open processed CSV
* View rows
* Paginate rows
* Download original CSV
* See failed jobs
* Retry failed jobs

---

# 49. Interview Demonstration

The project should be explainable in approximately 2 minutes.

Suggested explanation:

> TaskFlow is a small distributed background-job system for processing CSV files. Instead of processing the CSV inside the upload API, I persist the file and create a job in PostgreSQL, then publish that job to a Redis Stream. The API immediately returns to the client while independent workers consume jobs asynchronously.
>
> Workers update the job lifecycle in PostgreSQL and process the CSV in batches. I use Redis consumer groups so multiple workers can consume jobs concurrently. Since message delivery can be at-least-once, I designed the processing to be idempotent using job-state checks and a unique file-id/row-number constraint.
>
> Temporary failures are retried with exponential backoff, while jobs exceeding the retry limit are marked failed for investigation. Worker concurrency is configurable to provide backpressure and prevent the database or CPU from being overloaded.
>
> The frontend simply displays the job lifecycle and processed CSV data.

---

# 50. Important Interview Questions

The implementation should allow you to answer:

### Why use a queue?

Because CSV processing can be slow and should not block the HTTP request.

### Why Redis Streams?

Because they provide persistent stream messages and consumer groups suitable for building a lightweight distributed worker system.

### Why not process the CSV inside Express?

It would increase request latency and tie expensive work to the API process.

### What happens if a worker crashes?

An unacknowledged message can remain pending and be recovered/claimed by another worker.

### Why at-least-once?

Because distributed message processing generally prioritizes reliable delivery, which means duplicate processing can occur.

### How do you handle duplicates?

Use idempotent processing and database uniqueness constraints.

### Why exponential backoff?

To avoid immediately hammering a dependency that may be temporarily unavailable.

### Why concurrency limits?

To prevent workers from consuming unlimited CPU/memory/database capacity.

### What happens when jobs arrive faster than workers process them?

The queue absorbs the backlog and workers process jobs at their available rate.

### What is a DLQ?

A place for jobs that cannot be successfully processed after the configured retry policy, allowing investigation without endless retries.

### Why PostgreSQL + Redis?

PostgreSQL is the durable source of truth for files, jobs, and processed data. Redis is optimized for fast queue/message operations.

### Why not store everything in Redis?

Redis is being used as the queue, while PostgreSQL provides durable application state and queryable data.

---

# 51. Future Extensions

Do NOT implement initially.

Possible Version 2:

```text
S3-compatible object storage
```

Possible Version 3:

```text
WebSocket live job updates
```

Possible Version 4:

```text
Multiple job types
```

Example:

```text
CSV_PROCESS
REPORT_GENERATE
EMAIL_SEND
IMAGE_PROCESS
```

Possible Version 5:

```text
Separate dead-letter Redis Stream
```

Possible Version 6:

```text
Metrics
```

Examples:

```text
queue depth
jobs/sec
average processing time
failure rate
retry rate
```

Possible Version 7:

```text
Prometheus + Grafana
```

Possible Version 8:

```text
Dockerize API + workers
```

Possible Version 9:

```text
Deploy to cloud
```

These are optional and should not delay Version 1.

---

# 52. AI Coding Agent Instructions

This section is specifically for Cursor Agent / Codex / Claude Code.

The coding agent must follow these rules.

## Rule 1 — Work Incrementally

Never implement the whole PRD in one operation.

Work one phase at a time.

After completing a phase:

1. Run the application.
2. Run relevant tests/checks.
3. Verify the expected behavior.
4. Report what changed.
5. Stop.

Wait for the user to request the next phase.

---

## Rule 2 — Do Not Invent Infrastructure

Do not assume:

```text
AWS credentials
S3 credentials
Redis Cloud credentials
Supabase credentials
Neon credentials
```

exist.

Initially use:

```text
Docker Redis
Docker PostgreSQL
Local filesystem
```

---

## Rule 3 — Environment Variables

Create:

```text
.env.example
```

with empty credential values.

Never commit:

```text
.env
```

Never hardcode credentials.

---

## Rule 4 — Keep Dependencies Minimal

Before adding a package:

1. Determine whether it is necessary.
2. Prefer standard Node.js functionality where reasonable.
3. Avoid introducing large frameworks unnecessarily.

---

## Rule 5 — Do Not Over-Engineer

This is a learning project.

Prefer:

```text
simple implementation
```

over:

```text
enterprise abstraction
```

Avoid unnecessary:

* repositories for every tiny operation
* factories
* dependency injection frameworks
* event buses
* complicated design patterns

Use clean TypeScript but keep the code understandable.

---

# 53. First Agent Prompt

When starting with Cursor Agent / Codex / Claude Code, provide this instruction first:

```text
You are implementing TaskFlow, a small distributed CSV background-job processing system.

The complete product requirements are provided in the attached PRD.

IMPORTANT:

Do NOT implement the entire PRD at once.

We will build the project incrementally.

For this first task ONLY, implement Phase 0 — Project Bootstrap.

Requirements:

1. Create the repository structure.
2. Create a root package.json.
3. Create a React + Vite + TypeScript frontend under ui.
4. Create a Node.js + Express + TypeScript API under server.
5. Create a Node.js + TypeScript worker under worker.
6. Add appropriate TypeScript configuration.
7. Add .gitignore.
8. Add .env.example files with EMPTY values.
9. Add basic README.
10. Add placeholder entry points for API and worker.
11. Make sure frontend, API, and worker can start independently.
12. Do not implement PostgreSQL yet.
13. Do not implement Redis yet.
14. Do not implement CSV processing yet.
15. Do not implement authentication.
16. Do not add unnecessary dependencies.

After implementation:

- Run the frontend.
- Run the API.
- Run the worker.
- Verify they start successfully.
- Report exactly what was created.
- Do NOT proceed to Phase 1.

Stop after Phase 0.
```

---

# 54. Second Agent Prompt

After Phase 0 is verified:

```text
Phase 0 is complete.

Now implement ONLY Phase 1 from the TaskFlow PRD.

Build the basic React UI using dummy JSON data.

Requirements:

1. Create a Files Dashboard.
2. Add a simple CSV upload UI.
3. Display a table of files.
4. Show file name.
5. Show status.
6. Show created date.
7. Add View action.
8. Add Retry action.
9. Use dummy JSON data only.
10. Do not connect to the API yet.
11. Do not add PostgreSQL.
12. Do not add Redis.
13. Do not implement actual upload.
14. Keep CSS simple.
15. Do not spend time on visual design.

After implementation:

- Run the frontend.
- Verify the UI works.
- Check TypeScript errors.
- Report what was implemented.
- Stop.

Do not proceed to Phase 2.
```

---

# 55. Third Agent Prompt

```text
Phase 1 is complete.

Now implement ONLY Phase 2 from the TaskFlow PRD.

Connect the React frontend to the Node.js API.

Requirements:

1. Implement GET /api/health.
2. Implement GET /api/files.
3. Implement POST /api/files.
4. For now use in-memory API data.
5. React should fetch file data from the API.
6. Remove the frontend dummy data dependency.
7. Keep POST /api/files simple for now.
8. Do not add PostgreSQL.
9. Do not add Redis.
10. Do not implement actual CSV persistence yet.

After implementation:

- Start API.
- Start frontend.
- Verify React successfully calls the API.
- Verify GET /api/files works.
- Verify POST /api/files works.
- Check TypeScript errors.
- Stop after Phase 2.
```

---

# 56. Development Principle

At every stage, maintain this mental model:

```text
Build
 ↓
Run
 ↓
Test
 ↓
Understand
 ↓
Commit
 ↓
Next phase
```

Never:

```text
Generate 5,000 lines
 ↓
Hope it works
```

The project is intended to teach distributed-system fundamentals while producing a portfolio project that can be discussed confidently in a 5-YOE interview.

---

# 57. Final Architecture

The final Version 1 architecture is:

```text
                    ┌───────────────────┐
                    │   React + Vite    │
                    │    Dashboard      │
                    └─────────┬─────────┘
                              │
                              │ HTTP
                              ▼
                    ┌───────────────────┐
                    │   Express API     │
                    │    Node + TS      │
                    └──────┬─────┬──────┘
                           │     │
                           │     │
                           ▼     ▼
                    ┌─────────┐ ┌──────────────┐
                    │Postgres │ │Redis Streams │
                    │         │ │              │
                    └────┬────┘ └──────┬───────┘
                         │             │
                         │             ▼
                         │       ┌─────────────┐
                         │       │   Worker 1  │
                         │       ├─────────────┤
                         │       │   Worker 2  │
                         │       ├─────────────┤
                         │       │   Worker 3  │
                         │       └──────┬──────┘
                         │              │
                         └──────────────┘
                                │
                                ▼
                         Process CSV
                                │
                                ▼
                         PostgreSQL
                         file_rows
```

The key story remains:

```text
Slow work
   ↓
Queue
   ↓
Workers
   ↓
Retry
   ↓
Idempotency
   ↓
Concurrency control
   ↓
Failure recovery
```

That is the core of TaskFlow.
