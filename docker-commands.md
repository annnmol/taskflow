# Docker Commands — Local Development Stack

Services:

- PostgreSQL
- Redis
- MinIO (S3-compatible storage)
- LocalStack (AWS services)
- Kafka and RabbitMQ are not included yet.

No Docker Compose profiles are used.

---

## 1. Start / create containers

### Start everything

```bash
docker compose up -d
```

### Start everything and recreate containers

```bash
docker compose up -d --force-recreate
```

### Start everything and pull newer images first

```bash
docker compose pull
docker compose up -d
```

### Start one service only

```bash
docker compose up -d postgres
```

```bash
docker compose up -d redis
```

```bash
docker compose up -d minio
```

```bash
docker compose up -d localstack
```

### Start multiple selected services

```bash
docker compose up -d postgres redis
```

```bash
docker compose up -d postgres redis minio
```

---

# 2. Check status

### Show services for this project

```bash
docker compose ps
```

### Show all Docker containers

```bash
docker ps -a
```

### Show only running containers

```bash
docker ps
```

### Show Docker disk usage

```bash
docker system df
```

---

# 3. Logs

### All services

```bash
docker compose logs -f
```

### PostgreSQL

```bash
docker compose logs -f postgres
```

### Redis

```bash
docker compose logs -f redis
```

### MinIO

```bash
docker compose logs -f minio
```

### LocalStack

```bash
docker compose logs -f localstack
```

Press `Ctrl+C` to stop following logs. The container keeps running.

---

# 4. Stop / restart

### Stop and remove all containers

```bash
docker compose down
```

This keeps persistent volumes/data.

### Stop one service

```bash
docker compose stop postgres
docker compose stop redis
docker compose stop minio
docker compose stop localstack
```

### Start a previously stopped service

```bash
docker compose start postgres
docker compose start redis
docker compose start minio
docker compose start localstack
```

### Restart everything

```bash
docker compose restart
```

### Restart one service

```bash
docker compose restart postgres
```

```bash
docker compose restart redis
```

```bash
docker compose restart minio
```

```bash
docker compose restart localstack
```

---

# 5. Delete everything

### Stop/remove containers but KEEP data

```bash
docker compose down
```

Your named volumes remain.

### Stop/remove containers AND DELETE project data

WARNING: This deletes PostgreSQL data, Redis persisted data, MinIO objects and LocalStack persisted state.

```bash
docker compose down -v
```

After deleting everything, recreate the stack with:

```bash
docker compose up -d
```

---

# 6. PostgreSQL

## Connection details

```text
Host:     localhost
Port:     5432
Database: taskflow
Username: dev
Password: devpassword
```

Use these credentials from `.env`.

## Open PostgreSQL CLI

```bash
docker compose exec postgres psql -U dev -d taskflow
```

Inside `psql`:

```text
\l
```

List databases.

```text
\dt
```

List tables.

```text
\d table_name
```

Describe a table.

```text
\q
```

Exit.

## Test PostgreSQL directly

```bash
docker compose exec postgres pg_isready -U dev -d taskflow
```

Expected output should indicate PostgreSQL is accepting connections.

## PostgreSQL UI

Use DBeaver:

```text
Host:     localhost
Port:     5432
Database: taskflow
Username: dev
Password: devpassword
```

---

# 7. Redis

## Connection details

Current local configuration intentionally uses no password.

```text
Host:     localhost
Port:     6379
Username: none
Password: none
```

## Open Redis CLI

```bash
docker compose exec redis redis-cli
```

## Test Redis

Inside Redis CLI:

```text
PING
```

Expected:

```text
PONG
```

## Basic Redis tests

```text
SET name Anmol
```

```text
GET name
```

```text
DEL name
```

```text
INFO
```

```text
DBSIZE
```

```text
QUIT
```

## Redis Streams

Create a stream entry:

```text
XADD jobs * type email userId 123
```

Read the stream:

```text
XRANGE jobs - +
```

Create a consumer group:

```text
XGROUP CREATE jobs workers 0 MKSTREAM
```

Read messages as a consumer:

```text
XREADGROUP GROUP workers worker-1 COUNT 10 STREAMS jobs >
```

Acknowledge a processed message:

```text
XACK jobs workers <message-id>
```

Check pending messages:

```text
XPENDING jobs workers
```

## Redis UI

Open Redis Insight and connect:

```text
Host: localhost
Port: 6379
```

No username/password is required with the current configuration.

---

# 8. MinIO — S3

MinIO provides local S3-compatible object storage.

## MinIO API

```text
http://localhost:9000
```

## MinIO Web UI

```text
http://localhost:9001
```

Login using the `.env` values:

```text
Username: minioadmin
Password: minioadmin123
```

## What to practice

Use the MinIO UI to practice:

- Create buckets
- Upload objects
- Download objects
- Delete objects
- Object metadata
- Folders/prefixes
- Versioning
- Policies

Your Node.js application can use the normal AWS SDK S3 client and point it to:

```text
http://localhost:9000
```

---

# 9. LocalStack — AWS services

LocalStack provides local AWS-compatible services.

S3 is intentionally handled by MinIO in this project.

## Start LocalStack only

```bash
docker compose up -d localstack
```

## LocalStack endpoint

```text
http://localhost:4566
```

## Check LocalStack logs

```bash
docker compose logs -f localstack
```

## Check LocalStack container

```bash
docker compose ps localstack
```

LocalStack can later be used for services such as:

- SQS
- SNS
- Lambda
- DynamoDB
- API Gateway

---

# 10. Inspect containers

### Inspect PostgreSQL

```bash
docker inspect taskflow-postgres
```

### Inspect Redis

```bash
docker inspect taskflow-redis
```

### Inspect MinIO

```bash
docker inspect taskflow-minio
```

### Inspect LocalStack

```bash
docker inspect taskflow-localstack
```

If you change `PROJECT_NAME`, the container names change accordingly.

---

# 11. Open a shell inside containers

### PostgreSQL

```bash
docker compose exec postgres bash
```

### Redis

```bash
docker compose exec redis sh
```

### MinIO

```bash
docker compose exec minio sh
```

### LocalStack

```bash
docker compose exec localstack bash
```

If a particular image does not contain the shell you request, use Docker Desktop's container terminal or the service-specific CLI commands above.

---

# 12. Validate Compose configuration

Before starting:

```bash
docker compose config
```

If the configuration is valid, Docker prints the resolved Compose configuration.

This is useful after changing `.env` or `docker-compose.yml`.

---

# 13. Pull images

Download/update images defined by the Compose file:

```bash
docker compose pull
```

Then start:

```bash
docker compose up -d
```

---

# 14. Docker cleanup

### Show disk usage

```bash
docker system df
```

### Detailed disk usage

```bash
docker system df -v
```

### Remove unused containers/networks/images

```bash
docker system prune
```

Be careful with:

```bash
docker system prune -a
```

It removes more unused images.

Do not add `--volumes` unless you intentionally want unused Docker volumes removed.

---

# 15. Useful Docker Desktop workflow

Docker Desktop is useful for visually checking:

- Containers
- Running/stopped state
- Logs
- CPU usage
- Memory usage
- Images
- Volumes
- Networks
- Container terminal

You do NOT need to manually create the services in Docker Desktop.

`docker-compose.yml` is the source of truth.

---

# 16. Recommended daily workflow

## Start work

```bash
docker compose up -d
```

## Check status

```bash
docker compose ps
```

## Work with databases/services

```text
DBeaver        → PostgreSQL
Redis Insight  → Redis
Browser        → MinIO
AWS SDK        → MinIO / LocalStack
```

## If something is failing

```bash
docker compose logs -f
```

Or inspect one service:

```bash
docker compose logs -f postgres
```

```bash
docker compose logs -f redis
```

```bash
docker compose logs -f minio
```

```bash
docker compose logs -f localstack
```

## Finish work

```bash
docker compose down
```

Data remains.

## Return later

```bash
docker compose up -d
```

Everything starts again with the existing data.

---

# 17. When the project is permanently finished

Delete containers and all persistent data:

```bash
docker compose down -v
```

Keep the project files:

```text
docker-compose.yml
.env
docker-commands.md
```

When you return months later:

```bash
docker compose up -d
```

Docker recreates the environment.

---

# 18. Quick reference

| Task | Command |
|---|---|
| Start everything | `docker compose up -d` |
| Start PostgreSQL | `docker compose up -d postgres` |
| Start Redis | `docker compose up -d redis` |
| Start MinIO | `docker compose up -d minio` |
| Start LocalStack | `docker compose up -d localstack` |
| Start selected services | `docker compose up -d postgres redis` |
| Check status | `docker compose ps` |
| All containers | `docker ps -a` |
| Running containers | `docker ps` |
| All logs | `docker compose logs -f` |
| PostgreSQL logs | `docker compose logs -f postgres` |
| Redis logs | `docker compose logs -f redis` |
| MinIO logs | `docker compose logs -f minio` |
| LocalStack logs | `docker compose logs -f localstack` |
| Stop everything, keep data | `docker compose down` |
| Delete everything + data | `docker compose down -v` |
| Restart everything | `docker compose restart` |
| Restart one service | `docker compose restart redis` |
| Validate Compose | `docker compose config` |
| Pull images | `docker compose pull` |
| Docker disk usage | `docker system df` |
| PostgreSQL CLI | `docker compose exec postgres psql -U dev -d taskflow` |
| Redis CLI | `docker compose exec redis redis-cli` |
| MinIO UI | `http://localhost:9001` |
| MinIO API | `http://localhost:9000` |
| LocalStack | `http://localhost:4566` |
