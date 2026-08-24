# Repository Guidelines

## Project Structure & Module Organization

TaskFlow is a Bun workspace for a distributed CSV-processing demo. `ui` is the React/Vite dashboard; its UI and styles live in `src/main.tsx` and `src/styles.css`. `server` is the Express API, with database, Redis, storage, and repository code under `src/`. `worker` consumes Redis Stream jobs and has matching infrastructure/repository modules. SQL migrations are in `server/migrations/`; reusable CSV fixtures are in `constants/`. Read `README.md` for architecture and operational behavior.

## Build, Test, and Development Commands

- `bun install` installs all workspace dependencies.
- `bun run db:up` starts PostgreSQL, Redis, and MinIO through Docker Compose; use `bun run db:down` to stop them.
- `bun run dev:web`, `bun run dev:api`, and `bun run dev:worker` start individual services. `bun run start` runs all development services.
- `bun run build` runs TypeScript builds for every workspace (including the web production build). Run it before submitting changes.

There is currently no automated test or lint script. Validate changes with `bun run build`, then manually exercise the affected API/UI workflow; use `constants/customers.csv` for an upload-and-processing smoke test.

## Coding Style & Naming Conventions

Write TypeScript using two-space indentation, double quotes, semicolons, and trailing commas only where existing code uses them. Keep modules focused: infrastructure clients in files such as `db.ts` or `redis.ts`, and database access in `src/repositories/<domain>.ts`. Use `camelCase` for values/functions, `PascalCase` for React components and types, and descriptive route/resource names. Preserve ESM imports with explicit `.js` extensions in API and worker source. Follow nearby code rather than introducing a formatter configuration.

## Testing Guidelines

Add tests alongside new test infrastructure when introducing behavior that is difficult to verify manually. Name test files after their unit or workflow, for example `jobs.test.ts` or `queue-file.integration.test.ts`. For worker changes, check retry, terminal-status, and acknowledgement behavior; for migrations, start fresh infrastructure and confirm the API health endpoint.

## Commit & Pull Request Guidelines

Recent history uses short, imperative summaries such as `timezone bug fixed`; keep commits focused and use similarly concise, lower-case subjects. Pull requests should explain the user-visible or operational change, list validation commands, link relevant issues when available, and include screenshots for dashboard changes. Call out migration, environment, queue, or retry-semantics changes explicitly.
