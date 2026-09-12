# VUKA Academy

**VUKA Academy** is a portable professional online-learning platform foundation for Mozambique and Africa. Its product promise is **Aprenda. Crie. Cresça.**

This repository currently implements **Phase 1** of the product plan: project architecture, relational database schema, OAuth-backed identity, role-aware backend procedures, protected access checks, demo course contracts, and a responsive public shell that introduces the four platform experiences.

## Phase 1 status

The foundation includes:

- React 19, TypeScript, Tailwind CSS, Express, tRPC, Drizzle ORM, MySQL/TiDB, and S3-ready storage helpers.
- OAuth session handling through the template's server-side callback and secure session cookie.
- User roles: `admin`, `formador`, `estudante`, and `empresa`.
- Relational tables for profiles, courses, categories, instructors, modules, lessons, materials, enrollments, quizzes, assignments, grades, progress, certificates, companies, partnership applications, notifications, and wishlist.
- Backend role gates in `server/routers.ts`; frontend navigation does not act as the security boundary.
- A public homepage, catalog, course detail, company landing page, partner application form, authentication entry points, and role-based area entry pages.
- `drizzle/seed.sql` with demo roles, categories, courses, modules, and lessons. These are explicitly demo records and can be replaced without changing the UI contracts.

The later phases remain intentionally scoped for follow-up work: full admin CRUD, student learning player, instructor content management, quizzes and assignments UI, company workspace, certificates, notifications, payments, and the complete legal/support content.

## 1. Install

Requirements: Node.js 20+, pnpm 10+, and a MySQL-compatible database (TiDB is supported by the WebDev environment).

```bash
pnpm install
```

## 2. Environment variables

Do not commit `.env` files. The managed environment provides the following values; for an external deployment, create equivalent secrets in your host:

```bash
DATABASE_URL=mysql://user:password@host:3306/vuka_academy
JWT_SECRET=replace-with-a-long-random-secret
VITE_APP_ID=your-oauth-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
OWNER_OPEN_ID=your-owner-open-id
OWNER_NAME=Project Owner
BUILT_IN_FORGE_API_URL=optional-server-side-api-url
BUILT_IN_FORGE_API_KEY=optional-server-side-api-key
```

For a non-Manus OAuth provider, replace the callback and provider implementation under `server/_core/` with your provider's OAuth 2.0 / OIDC flow while keeping the `ctx.user` contract and role checks unchanged.

## 3. Configure the database

The schema is defined in `drizzle/schema.ts`. The generated migration is stored in `drizzle/0001_yummy_turbo.sql` and was applied to the development database during this build.

For a fresh external database:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

If your deployment environment requires an explicit SQL migration runner, execute the generated SQL transactionally with your provider's migration tool. Do not hand-edit the generated migration unless the schema and migration history are updated together.

## 4. Run locally

```bash
pnpm dev
```

The Vite/Express server starts the application and API together. The public homepage is `/`.

## 5. Seed demo data

The seed is intentionally a reviewable SQL file:

```bash
mysql "$DATABASE_URL" < drizzle/seed.sql
```

The seed uses idempotent inserts for roles, categories, and course content. Replace the records with production content before launch.

## 6. Build

```bash
pnpm check
pnpm test
pnpm build
```

The build creates the browser bundle and an ESM server bundle in `dist/`.

## 7. Run in production

```bash
NODE_ENV=production node dist/index.js
```

Set the production secrets in the host environment and bind the process to the port supplied by the host.

## 8. Deploy outside Manus

The project is intentionally structured around standard React, Express, tRPC, Drizzle, MySQL/TiDB, and S3-compatible storage contracts. A typical deployment is:

1. Create a MySQL/TiDB database and an S3-compatible bucket.
2. Configure the environment variables above in the host's secret manager.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm drizzle-kit migrate` against the target database.
5. Run `pnpm build`.
6. Start with `NODE_ENV=production node dist/index.js`.
7. Put the service behind HTTPS and a reverse proxy or managed load balancer.
8. Point the custom domain to the host and configure the OAuth redirect URI for the production origin.

The frontend does not store private files in `client/public`; storage references should be kept as metadata and served through signed/private storage routes when content management is implemented.

## 9. Custom domain

The application does not hard-code a Manus domain. To use `vukaacademy.com` or `www.vukaacademy.com`, configure DNS at your registrar, issue an HTTPS certificate at the hosting provider, and update the OAuth provider's allowed callback and origin settings.

## Security notes

Role checks live in backend procedures. The next phases must continue to enforce row-level ownership for company users, instructor course assignments, and student enrollments at the procedure/query layer. Passwords are not stored by this application; identity is delegated to the configured OAuth provider. Private files must use storage keys and signed access, not public URLs.

## Product phases

1. Architecture, database, authentication, and roles — **implemented**.
2. Homepage, public pages, and course catalog — **foundation shell implemented; full catalog filters/pagination next**.
3. Admin and course management.
4. Student dashboard and learning player.
5. Instructor dashboard and content management.
6. Quizzes, assignments, grades, and performance.
7. Company workspace, applications, and collaborators.
8. Certificates, notifications, and reports.
9. Payment-ready integrations.
10. Security hardening, end-to-end tests, production, and documentation.

## Phase 2 implemented

The current build now includes the core learning loop and administration surface:

- Student dashboard with overall progress, active courses, next lesson, activity summary, and certificate count.
- Learning player at `/dashboard/cursos/:id` with module/lesson navigation, video/text/PDF lesson states, persisted completion mutations, quiz submission, assignment submission, and certificate issuance.
- Quiz and assignment persistence through `quiz_attempts`, `assignment_submissions`, and `grades`.
- Certificate issuance with unique certificate numbers stored in `certificates`; the demo fallback returns a deterministic number when the demo account is not yet persisted.
- Admin dashboard at `/admin` with protected access and CRUD operations for courses, categories, and formadores. Instructor removal is implemented as a safe soft deactivation, preserving historical ownership and auditability.
- `drizzle/seed.sql` now includes a sample quiz, questions, and assignment for the project-management course.

The backend remains the permission boundary. Student mutations require a signed-in student-compatible role, while all management mutations require `admin`. Production deployments should extend the same ownership checks to enrollment, instructor assignment, and company scope as those workspaces are expanded.

## Phase 3 implemented

The administration surface now includes `/admin/curriculum`, where administrators can select a course, create and reorder modules, manage lessons, publish or keep them as drafts, and remove obsolete content. Each lesson supports video, text, PDF, and material types and exposes a private-material upload control.

The upload endpoint is `POST /api/lesson-materials/upload`. It authenticates the current Manus session, accepts files up to 250 MB, limits MIME types to video/PDF/archive/Office/text formats, stores bytes through the built-in S3-backed storage helper, and persists only the storage key, URL, filename, and MIME metadata in `lesson_materials`. Formadores are limited to lessons belonging to courses assigned to them.

Quizzes now support create/delete, question creation and deletion, question types, answer options, points, ordering, passing scores, and attempt limits. Assignments support create/delete with instructions and maximum scores. The formador dashboard at `/formador/relatorios` aggregates active students, average progress, completion rate, quiz score, and pending assignment counts per assigned course.

## Phase 4 implemented

The student player now renders uploaded video materials with native browser controls and embeds uploaded PDFs directly in the lesson view; other lesson materials remain available as secure links. Formador reports accept a date range, course, persisted turma/cohort, and student filter, returning filtered metrics and selectable filter options. Administrators can edit existing quiz questions and assignments inline, including question type, options, points, ordering, instructions, due date, and maximum score.

## Phase 5 implemented

The student video player now supports WebVTT/SRT caption tracks when uploaded as lesson materials, selectable playback speeds from 0.75x to 2x, and persisted playback position per student and lesson. Formador reports expose CSV and PDF download buttons that preserve the active period, course, turma, and student filters; the PDF route is authenticated and returns a generated PDF attachment. Administrators can fully edit quiz title, description, passing score, attempt limit, and due date inline from the curriculum manager.
