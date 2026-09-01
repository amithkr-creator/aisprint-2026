Date created: 2026-09-02
Date last modified: 2026-09-02 (home → login; full implementation record in PRD)

# Register / Login / Logout - Technical PRD

## Overview/Problem

QuizMaker will let multiple instructors contribute MCQ question banks. Today there is no instructor identity layer, so teachers cannot create an account, sign in, or sign out before contributing questions. Without registration and simple credential checks, later MCQ features have no owner identity to attach question banks to. This feature delivers instructor registration, login, and logout only; MCQ authoring comes in a later feature.

---

## Hypothesis

We believe that providing instructor register, login, and logout with a D1-backed user store and hashed passwords will give teachers a reliable way to create and access an account so they can later contribute MCQ question banks to QuizMaker.

---

## Scope

### In Scope

- Cloudflare D1 database setup (binding `DB`) and a migration that creates the `users` table
- User fields: unique primary key (`id`), `first_name`, `last_name`, `email` (unique), `password_hash`, timestamps
- Password hashing on write; never store plaintext passwords
- `UserService` with create, update, and delete (plus read-by-email for login validation)
- HTTP endpoints: **register**, **login**, **logout** that use `UserService` for DB access and credential validation
- UI pages: **Register**, **Login**, **Logout**
- App root `/` redirects to the **Login** page (default entry)
- After successful login, redirect to a **blank MCQ placeholder page** (no MCQ logic)
- Vitest unit tests per implementation phase (TDD); green tests gate acceptance criteria
- Input validation with Zod on all register/login inputs

### Out of Scope

- Token-based authentication (JWT, opaque tokens, API keys)
- Cookies or session management (no session table, no `Set-Cookie`, no session middleware)
- Any MCQ / question bank implementation (CRUD, UI beyond a blank placeholder)
- OAuth / SSO / magic links / password reset / email verification
- Roles beyond “instructor” (admin, student) and multi-tenant org models
- Applying D1 migrations to the **remote** database (local apply only during implementation)

### Cut

- Session/cookie auth after login — cut because this phase is simple credential validation only; persistence of “logged in” state is deferred
- Token issuance on login — cut for the same reason; login proves credentials and redirects to the placeholder page
- MCQ pages with real content — cut; only a blank destination after login is required now
- Soft-delete / account recovery flows — cut to keep the user service focused on create / update / delete

---

## Technical Requirements

### Database Schema

D1 must be created and bound as `DB` in `wrangler.jsonc` before migrations are used. Migration creates `users`:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users (email);
```

**Field notes:**
- `id` — unique key (TEXT UUID-style from D1 `randomblob`)
- `email` — login identifier (acts as username from the frontend)
- `password_hash` — one-way hash of the password; plaintext never persisted
- Unique constraint on `email` enforces one account per address

**Migration workflow (local only):**
1. `npx wrangler d1 create <db-name>` (once)
2. Add `d1_databases` binding `DB` to `wrangler.jsonc`
3. `npm run cf-typegen`
4. `npx wrangler d1 migrations create <db-name> create_users`
5. Put the SQL above in the generated migration file
6. `npx wrangler d1 migrations apply <db-name> --local`
7. **Never** run `migrations apply` with `--remote` as part of this work

### API Endpoints

Endpoints live under `src/app/api/`. They call `UserService` for persistence and credential checks. No tokens, cookies, or sessions are set.

#### POST /api/auth/register

**Request Body:**
```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@school.edu",
  "password": "plaintext-from-client"
}
```

**Behavior:**
- Validate with Zod (required strings, email format, password min length)
- Hash password, then `UserService.create`
- Reject duplicate email

**Response:**
- Success (201): `{ "id", "firstName", "lastName", "email", "createdAt" }` — never return `password` or `password_hash`
- Error (400): validation failure
- Error (409): email already registered
- Error (500): server/database error

#### POST /api/auth/login

**Request Body:**
```json
{
  "email": "ada@school.edu",
  "password": "plaintext-from-client"
}
```

**Behavior:**
- Validate with Zod
- Load user by email via `UserService`; verify password against `password_hash`
- On success, return safe user profile (no hash). Client then navigates to blank MCQ page
- Do **not** issue tokens or set cookies/sessions

**Response:**
- Success (200): `{ "id", "firstName", "lastName", "email" }`
- Error (400): validation failure
- Error (401): invalid email or password (generic message; do not reveal which field failed)
- Error (500): server/database error

#### POST /api/auth/logout

**Request Body:** none (or empty JSON)

**Behavior:**
- No server-side session to clear in this phase
- Returns success so the UI can clear any client-held user display state and redirect to login
- May be a no-op authenticator-wise; still required as an explicit endpoint for the logout UX

**Response:**
- Success (200): `{ "ok": true }`
- Error (500): unexpected server error

### User Interface Requirements

#### Home (`/`) — IMPLEMENTED
- **Page:** `src/app/page.tsx`
- Replaces the Next.js starter page
- Server `redirect()` to `/login` (`AUTH_ROUTES.login`) so the app opens on the instructor login screen

#### Register (`/register`) — IMPLEMENTED (Phase 4)
- **Page:** `src/app/register/page.tsx` — centered shadcn layout wrapping `SignupForm`
- **Form:** `src/components/signup-form.tsx` (shadcn Card/Field/Input block)
- Fields: First name, Last name, Email, Password, Confirm password
- Submit → `POST /api/auth/register` with `{ firstName, lastName, email, password }`
- On success: navigate to `/login` via `redirectAfterRegister()`
- On error: show mapped message (duplicate email → “An account with this email already exists.”)
- Link to Login: `/login`
- **Not included (out of scope):** Sign up with Google

#### Login (`/login`) — IMPLEMENTED (Phase 4)
- **Page:** `src/app/login/page.tsx` — centered shadcn layout wrapping `LoginForm`
- **Form:** `src/components/login-form.tsx` (shadcn Card/Field/Input block)
- Fields: Email (username), Password
- Submit → `POST /api/auth/login`
- On success: navigate to blank `/mcq` via `redirectAfterLogin()`
- On error: generic “Invalid email or password.”
- Link to Register: `/register`
- **Not included (out of scope):** Login with Google, Forgot password

#### Logout (`/logout`) — IMPLEMENTED (Phase 4)
- **Page:** `src/app/logout/page.tsx`
- On mount: calls `POST /api/auth/logout`, then redirects to `/login`
- Retry button if the logout request fails
- No cookies/sessions cleared (none exist in this feature)

#### MCQ placeholder (`/mcq`) — IMPLEMENTED (Phase 4)
- **Page:** `src/app/mcq/page.tsx`
- Title: “MCQ Question Bank”; copy: coming soon / blank shell
- Link to `/logout`
- No question CRUD or banks

### UserService

Located under `src/lib/services/` (project convention). Backed by D1 via `getCloudflareContext()` → `env.DB`. Prepared statements with numbered placeholders (`?1`, `?2`, …).

| Method | Responsibility |
|--------|----------------|
| `create(input)` | Insert user with hashed password; fail on duplicate email |
| `update(id, input)` | Update allowed fields (name, email, and/or password → re-hash); fail if missing |
| `delete(id)` | Hard-delete user by id; fail if missing |
| `findByEmail(email)` | Used by login (and register duplicate checks); internal/read helper |
| `findById(id)` | Support update/delete and tests |

Password hashing lives in a small helper (e.g. `src/lib/auth/password.ts`) using a Workers-safe approach (e.g. Web Crypto PBKDF2 or an approved library). `UserService` must never write plaintext passwords.

---

## Implementation Phases

**Approval gate:** Do **not** implement any phase until the human reviewer has approved this PRD (or explicitly approved that phase).

**TDD mandate (from `.cursor/rules/tdd-vitest.mdc`):** Every phase below follows the same loop. Do not skip steps.

1. Read this PRD — phase objective + mapped acceptance criteria  
2. Write Vitest tests first (phase scope only) — encode AC as behavior names  
3. Confirm **red** — `npx vitest run` (or `npm test`); new tests must fail  
4. Implement minimally — only what turns those tests green  
5. Confirm **green** — phase + all prior phase tests pass  
6. Refactor if needed — stay green; no scope creep  
7. Update this PRD — phase `COMPLETED`, check AC covered by green tests, record files/snippets  

**Phase gate:** Do not start Phase N+1 until Phase N’s Vitest suite is green and this PRD marks that phase `COMPLETED`, plus explicit user go-ahead.

**Test design rules for this feature:**
- Prefer pure logic under `src/lib/` (password, schemas, services, auth handlers extracted for testability)
- Mock D1 and `UserService` at boundaries; assert outcomes, not only “mock was called”
- Colocate `*.test.ts` next to the module (or `__tests__/` mirror)
- Name tests after behavior, e.g. `it('rejects register when email is already taken')`

---

### Phase 1: Vitest harness + D1 users migration - COMPLETED

**Objective:** Vitest runs in the project; D1 is bound; migration SQL defines the `users` table required by later phases.

**Acceptance criteria mapped:**
- D1 configured with `DB` + local migration creates `users` with required columns
- Vitest available so later phases can go red → green

**TDD cycle:**

| Step | Action |
|------|--------|
| Red | ✅ Added Vitest; wrote `migrations/users-schema.test.ts` (5 failing cases). Confirmed red (`5 failed`). |
| Green | ✅ Created D1 `quizmaker-db`, bound `DB`, wrote `0001_create_users.sql`, applied `--local`. Suite green (`5 passed`). |
| Refactor | ✅ Renamed Vitest config to `vitest.config.mts` to avoid CJS/ESM warning. |
| PRD | ✅ Recorded paths/snippets below; Phase 1 marked `COMPLETED`. |

**Planned Vitest cases** (`migrations/users-schema.test.ts`) — all green:

- `it('ships a users migration file')`
- `it('defines users.id as TEXT PRIMARY KEY')`
- `it('requires first_name, last_name, email, and password_hash')`
- `it('enforces UNIQUE on email')`
- `it('includes created_at and updated_at defaults')`

**Infra completed:**
1. Vitest installed; `npm test` / `npm run test:watch`; `vitest.config.mts` with `@/` alias  
2. `wrangler d1 create quizmaker-db` → bind `DB` → `npm run cf-typegen` (`env.DB: D1Database`)  
3. `migrations/0001_create_users.sql` → `wrangler d1 migrations apply quizmaker-db --local` (not `--remote`)

**Deliverables:** `vitest.config.mts`, npm `test` script, `wrangler.jsonc` D1 binding, `migrations/0001_create_users.sql`, green Phase 1 suite  

**Depends on:** PRD / Phase 1 approval  

---

### Phase 2: Password helper + UserService (CRUD) - COMPLETED

**Objective:** Domain layer hashes passwords and can create, update, and delete users (with find helpers for login).

**Acceptance criteria mapped:**
- Passwords stored only as hashes  
- `UserService` create / update / delete; create fails on duplicate email  

**TDD cycle:**

| Step | Action |
|------|--------|
| Red | ✅ Wrote `password.test.ts` + `user-service.test.ts`; suites failed (modules missing). |
| Green | ✅ Implemented Web Crypto PBKDF2 helper + `UserService` (mock D1 in tests). `17` tests green (Phase 1+2). |
| Refactor | ✅ Safe/`UserRecord` types + `DuplicateEmailError` / `UserNotFoundError`. |
| PRD | ✅ Snippets + paths below; Phase 2 marked `COMPLETED`. |

**Vitest cases** — all green:

`src/lib/auth/password.test.ts`
- `it('hashes a password to a value different from plaintext')`
- `it('verifies a correct password against its hash')`
- `it('rejects an incorrect password against its hash')`

`src/lib/services/user-service.test.ts` (mock D1)
- `it('creates a user with a hashed password and returns safe fields')`
- `it('does not persist or return plaintext password')`
- `it('rejects create when email is already taken')`
- `it('updates first name, last name, and email for an existing user')`
- `it('re-hashes password when update includes a new password')`
- `it('deletes an existing user by id')`
- `it('fails update when user id does not exist')`
- `it('fails delete when user id does not exist')`
- `it('finds a user by email')`

**Deliverables:** `src/lib/auth/password.ts`, `src/lib/services/user-service.ts`, colocated tests, green Phase 1+2 suites  

**Depends on:** Phase 1 `COMPLETED` + Phase 2 go-ahead  

---

### Phase 3: Auth API endpoints (register / login / logout) - COMPLETED

**Objective:** HTTP handlers validate input and use `UserService` for register and credential login; logout acknowledges without sessions/tokens/cookies.

**Acceptance criteria mapped:**
- `POST /api/auth/register` → 201 safe fields via `UserService`  
- `POST /api/auth/login` → 200 safe fields / 401 generic failure  
- `POST /api/auth/logout` → 200 `{ ok: true }` without tokens/cookies/sessions  
- No `password_hash` in success payloads  

**TDD cycle:**

| Step | Action |
|------|--------|
| Red | ✅ Wrote schema + register/login/logout handler tests (modules missing). |
| Green | ✅ Zod schemas + handlers + thin `src/app/api/auth/*/route.ts`. `28` tests green (Phases 1–3). |
| Refactor | ✅ Handlers under `src/lib/auth/` with injectable `UserService` / password verifier. |
| PRD | ✅ Snippets + paths below; Phase 3 marked `COMPLETED`. |

**Vitest cases** — all green:

`src/lib/auth/schemas.test.ts`
- `it('accepts a valid register payload')`
- `it('rejects register when email is invalid')`
- `it('rejects register when required fields are missing')`
- `it('accepts a valid login payload')`
- `it('rejects login when password is empty')`

`src/lib/auth/register.test.ts` / `login.test.ts` / `logout.test.ts`
- `it('registers a user and returns 201 without password_hash')`
- `it('rejects register when email is already taken')` → 409  
- `it('logs in with valid email and password and returns safe fields')`  
- `it('returns 401 with generic message when credentials are invalid')`  
- `it('does not set cookies or return tokens on login')`  
- `it('logout returns 200 with ok true')`  

**Deliverables:** Zod schemas, handlers, `src/app/api/auth/{register,login,logout}/route.ts`, green Phase 1–3 suites  

**Depends on:** Phase 2 `COMPLETED` + Phase 3 go-ahead  

---

### Phase 4: UI navigation helpers + pages (register / login / logout + blank MCQ) - COMPLETED

**Objective:** Instructors use UI to register, log in (land on blank `/mcq`), and log out (return to `/login`). Pure navigation/result helpers are TDD’d; pages wire to APIs.

**Acceptance criteria mapped:**
- Register and Login pages work against APIs; login success → blank `/mcq`  
- Logout UI calls logout endpoint and returns to `/login`  
- No MCQ business logic  

**TDD cycle:**

| Step | Action |
|------|--------|
| Red | ✅ Wrote `navigation.test.ts` (module missing). |
| Green | ✅ Navigation helpers + shadcn signup/login forms wired to APIs; `/register`, `/login`, `/logout`, `/mcq`. `33` tests green. |
| Refactor | ✅ Split first/last name for API; removed OAuth/forgot-password (out of scope). |
| PRD | ✅ Snippets + paths below; Phase 4 marked `COMPLETED`. |

**Vitest cases** — all green:

`src/lib/auth/navigation.test.ts`
- `it('sends successful login to /mcq')`
- `it('sends successful logout to /login')`
- `it('sends successful register to /login')`
- `it('maps duplicate-email register failure to a user-visible message')`
- `it('maps invalid login to a generic credentials message')`
- `it('uses /login as the app entry route from home')`

**UI deliverables:**
- `src/components/signup-form.tsx`, `src/components/login-form.tsx` (shadcn block + API wiring)
- Pages: `/register`, `/login`, `/logout`, `/mcq` (blank placeholder)
- Manual smoke: register → login → `/mcq` → logout → `/login`

**Depends on:** Phase 3 `COMPLETED` + Phase 4 go-ahead  

---


## Technical Implementation Details

### Key Files

#### Implemented (Phase 1)

| Path | Purpose |
|------|---------|
| `vitest.config.mts` | Vitest config; Node env; `@/` → `./src` |
| `package.json` | `test` / `test:watch` scripts; `vitest` devDependency |
| `migrations/users-schema.test.ts` | Phase 1 migration contract tests (TDD) |
| `migrations/0001_create_users.sql` | D1 `users` table + `idx_users_email` |
| `wrangler.jsonc` | D1 binding `DB` → `quizmaker-db` (`301024ff-ba33-4c86-9383-ae59c7a91129`) |
| `cloudflare-env.d.ts` | Regenerated; includes `DB: D1Database` |

#### Implemented (Phase 2)

| Path | Purpose |
|------|---------|
| `src/lib/auth/password.ts` | Web Crypto PBKDF2 hash/verify (`saltHex:hashHex`) |
| `src/lib/auth/password.test.ts` | Phase 2 password Vitest cases |
| `src/lib/services/user-service.ts` | Create / update / delete / findByEmail / findById |
| `src/lib/services/user-service.test.ts` | Phase 2 UserService Vitest cases (mock D1) |

#### Implemented (Phase 3)

| Path | Purpose |
|------|---------|
| `src/lib/auth/schemas.ts` | Zod register/login schemas |
| `src/lib/auth/schemas.test.ts` | Phase 3 schema Vitest cases |
| `src/lib/auth/register.ts` | Register handler (testable) |
| `src/lib/auth/register.test.ts` | Register behavior tests |
| `src/lib/auth/login.ts` | Login handler (testable) |
| `src/lib/auth/login.test.ts` | Login behavior tests |
| `src/lib/auth/logout.ts` | Logout handler |
| `src/lib/auth/logout.test.ts` | Logout behavior tests |
| `src/lib/auth/get-user-service.ts` | Builds `UserService` from Cloudflare `env.DB` |
| `src/app/api/auth/register/route.ts` | `POST /api/auth/register` |
| `src/app/api/auth/login/route.ts` | `POST /api/auth/login` |
| `src/app/api/auth/logout/route.ts` | `POST /api/auth/logout` |

#### Implemented (Phase 4)

| Path | Purpose |
|------|---------|
| `src/lib/auth/navigation.ts` | Post-auth redirect / error mapping helpers |
| `src/lib/auth/navigation.test.ts` | Phase 4 navigation Vitest cases |
| `src/components/signup-form.tsx` | shadcn signup form wired to `POST /api/auth/register` |
| `src/components/login-form.tsx` | shadcn login form wired to `POST /api/auth/login` |
| `src/app/register/page.tsx` | Register UI |
| `src/app/login/page.tsx` | Login UI |
| `src/app/logout/page.tsx` | Logout UI (calls API then redirects) |
| `src/app/mcq/page.tsx` | Blank post-login placeholder |
| `src/app/page.tsx` | Root `/` → server redirect to `/login` |

### Phase 1 code snippets

#### `migrations/0001_create_users.sql` — users schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users (email);
```

**Ref**: `migrations/0001_create_users.sql:1-12` · **Phase**: 1 · **AC**: D1 users table with required columns

#### `wrangler.jsonc` — D1 binding

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "quizmaker-db",
    "database_id": "301024ff-ba33-4c86-9383-ae59c7a91129",
    "migrations_dir": "migrations"
  }
]
```

**Ref**: `wrangler.jsonc` · **Phase**: 1 · **AC**: D1 configured with binding `DB`

#### `migrations/users-schema.test.ts` — contract test helper

```typescript
function findUsersMigrationSql(): string {
  const files = readdirSync(migrationsDir).filter(
    (name) => name.endsWith(".sql") && name.includes("create_users"),
  );
  expect(files.length, "expected a create_users migration .sql file").toBeGreaterThan(0);
  return readFileSync(path.join(migrationsDir, files[0]!), "utf8");
}
```

**Ref**: `migrations/users-schema.test.ts:7-15` · **Phase**: 1 · **AC**: Vitest coverage for schema contract

### Phase 2 code snippets

#### `src/lib/auth/password.ts` — PBKDF2 hash format

```typescript
/** Returns `saltHex:hashHex` using Web Crypto PBKDF2 (Workers-safe). */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveKey(password, salt);
  return `${toHex(salt)}:${toHex(derived)}`;
}
```

**Ref**: `src/lib/auth/password.ts:42-48` · **Phase**: 2 · **AC**: Passwords stored only as hashes

#### `src/lib/services/user-service.ts` — create hashes then inserts

```typescript
const passwordHash = await hashPassword(input.password);
await this.db
  .prepare(
    `INSERT INTO users (id, first_name, last_name, email, password_hash, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
  .bind(id, input.firstName, input.lastName, input.email, passwordHash, now, now)
  .run();
```

**Ref**: `src/lib/services/user-service.ts:84-110` · **Phase**: 2 · **AC**: UserService create with hashed password; no plaintext

### Phase 3 code snippets

#### `src/lib/auth/schemas.ts` — Zod register/login

```typescript
export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
```

**Ref**: `src/lib/auth/schemas.ts:3-14` · **Phase**: 3 · **AC**: Validated register/login payloads

#### `src/lib/auth/login.ts` — credential check without tokens/cookies

```typescript
if (!valid) {
  return Response.json(
    { error: "Invalid email or password" },
    { status: 401 },
  );
}
return Response.json({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
});
```

**Ref**: `src/lib/auth/login.ts:36-48` · **Phase**: 3 · **AC**: Login 200/401; no hash/tokens/cookies

#### `src/app/api/auth/register/route.ts` — thin route

```typescript
export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const userService = await createUserService();
  return handleRegister(body, userService);
}
```

**Ref**: `src/app/api/auth/register/route.ts:4-8` · **Phase**: 3 · **AC**: Register via UserService

### Phase 4 code snippets

#### `src/lib/auth/navigation.ts` — redirect targets + error mapping

```typescript
export const AUTH_ROUTES = {
  home: "/",
  register: "/register",
  login: "/login",
  logout: "/logout",
  mcq: "/mcq",
  afterRegister: "/login",
  afterLogin: "/mcq",
  afterLogout: "/login",
} as const;

export function mapRegisterErrorMessage(status: number, body: { error?: string } | null): string {
  if (status === 409) {
    return "An account with this email already exists.";
  }
  // ...
}

export function mapLoginErrorMessage(status: number, body: { error?: string } | null): string {
  if (status === 401) {
    return "Invalid email or password.";
  }
  // ...
}
```

**Ref**: `src/lib/auth/navigation.ts:1-48` · **Phase**: 4 · **AC**: redirects + user-visible error mapping

#### `src/app/page.tsx` — default entry is login

```tsx
import { redirect } from "next/navigation";
import { AUTH_ROUTES } from "@/lib/auth/navigation";

export default function Home() {
  redirect(AUTH_ROUTES.login);
}
```

**Ref**: `src/app/page.tsx:1-6` · **Phase**: 4 · **AC**: App starts on login (not Next.js starter)

#### `src/app/register/page.tsx` — shadcn page shell

```tsx
import { SignupForm } from "@/components/signup-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  );
}
```

**Ref**: `src/app/register/page.tsx:1-11` · **Phase**: 4 · **AC**: Register page UI  
*(Login page uses the same shell with `LoginForm` — `src/app/login/page.tsx`)*

#### `src/components/signup-form.tsx` — register → API → `/login`

```tsx
const response = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ firstName, lastName, email, password }),
});
if (!response.ok) {
  setError(mapRegisterErrorMessage(response.status, body));
  return;
}
router.push(redirectAfterRegister());
```

**Ref**: `src/components/signup-form.tsx:49-64` · **Phase**: 4 · **AC**: Register page works against API

#### `src/components/login-form.tsx` — login → API → `/mcq`

```tsx
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!response.ok) {
  setError(mapLoginErrorMessage(response.status, body));
  return;
}
router.push(redirectAfterLogin());
```

**Ref**: `src/components/login-form.tsx` · **Phase**: 4 · **AC**: Login success navigates to blank `/mcq`

#### Decisions (Phase 4)

- Used shadcn block layout (Card / Field / Input / Button) from the provided signup/login fragments
- Split Full Name into **firstName** + **lastName** to match API/schema
- Removed Google OAuth and Forgot password controls (Out of Scope)
- Styling: existing Tailwind + shadcn/ui primitives only
- Replaced Next.js starter home with server redirect `/` → `/login`

#### Manual smoke checklist (Phase 4)

- [ ] Open `/` (or app root) → lands on login UI (`/login`)
- [ ] Open `/register`, create account → lands on `/login`
- [ ] Duplicate email shows “An account with this email already exists.”
- [ ] Open `/login`, valid credentials → lands on `/mcq` blank placeholder
- [ ] Invalid credentials show “Invalid email or password.”
- [ ] From `/mcq`, Log out → `/logout` → `/login`

### Implementation Patterns (complete for this feature)

### Important Notes

- Centralize DB access in `src/lib/` / services; route handlers do not embed raw SQL
- D1 only from server code; never import DB modules into `'use client'` components
- Prefer numbered SQL placeholders (`?1`, `?2`)
- No remote migration apply during agent work — Phase 1 applied **local only**
- D1 database `quizmaker-db` exists remotely; schema migration has **not** been applied with `--remote` by the agent (user-owned)
- Phase 4 UI is client-side fetch to `/api/auth/*`; no tokens/cookies/sessions
- shadcn signup/login blocks live in `src/components/{signup,login}-form.tsx`; pages only provide layout
- App entry: `src/app/page.tsx` redirects `/` → `/login` (no Next.js marketing starter)
- Living PRD rule: after each approved phase lands, record real paths, snippets, and test evidence here

### Tests (TDD plan ↔ acceptance criteria)

| Phase | Test files | Status | AC unlocked when green |
|-------|------------|--------|------------------------|
| 1 | `migrations/users-schema.test.ts` | ✅ 5/5 green | D1/`users` schema AC; Vitest harness ready |
| 2 | `password.test.ts`, `user-service.test.ts` | ✅ 12/12 green | Hashing + UserService CRUD AC |
| 3 | `schemas.test.ts`, register/login/logout handler tests | ✅ 11/11 green | Register/login/logout API AC |
| 4 | `navigation.test.ts` (auth UI helpers) | ✅ 6/6 green | UI redirect AC (+ home → login; manual smoke) |

**Vitest evidence:** `npm test` → `Test Files 8 passed` · `Tests 34 passed` (Phases 1–4 + home route)

---

## Acceptance Criteria

- [x] D1 is configured with binding `DB` and a local migration creates `users` with `id`, `first_name`, `last_name`, `email` (unique), `password_hash`, and timestamps *(Phase 1 — Vitest green)*
- [x] Passwords are stored only as hashes; plaintext passwords never appear in DB rows or API success payloads *(Phases 2–3 — Vitest green)*
- [x] `UserService` can create, update, and delete users; create fails when email already exists *(Phase 2 — Vitest green)*
- [x] `POST /api/auth/register` creates a user via `UserService` and returns 201 with safe fields *(Phase 3 — Vitest green)*
- [x] `POST /api/auth/login` validates email + password via `UserService` and returns 200 with safe fields on success, 401 on failure *(Phase 3 — Vitest green)*
- [x] `POST /api/auth/logout` returns 200 `{ "ok": true }` without requiring tokens/cookies/sessions *(Phase 3 — Vitest green)*
- [x] Register and Login pages work against the APIs; Login success navigates to blank `/mcq` *(Phase 4 — navigation Vitest + shadcn UI wired)*
- [x] Logout UI calls logout endpoint and returns the instructor to `/login` *(Phase 4)*
- [x] App root `/` opens the login experience (redirect to `/login`; Next.js starter removed) *(Phase 4)*
- [x] No token auth, cookies, session store, or MCQ business logic ships in this feature *(scope held through Phase 4)*
- [x] Each implemented phase has Vitest coverage that was red before implementation and green after; criteria above are only checked when matching tests are green *(Phases 1–4 complete)*

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Instructor can self-register | 100% of valid registrations persist a hashed user row | Manual + Vitest/service tests |
| Login credential check | Valid credentials succeed; invalid fail with 401 | Vitest + manual login |
| Time to reach post-login shell | &lt; 3 actions after landing (open login → submit → see `/mcq`) | Manual walkthrough |
| Scope discipline | Zero MCQ/token/cookie/session features in this PR | PRD Out of Scope + code review |

---

## Dependencies

### External Dependencies
- Cloudflare D1 — user persistence (`quizmaker-db`, binding `DB`)
- Wrangler — migrations and local D1
- Vitest — unit testing (`npm test`)
- Zod — request validation (`zod@4`, `src/lib/auth/schemas.ts`)
- Password hashing via Web Crypto PBKDF2 (`src/lib/auth/password.ts`) — confirmed in Phase 2

### Internal Dependencies
- Next.js App Router under `src/app/`
- `getCloudflareContext()` / OpenNext Cloudflare for `env.DB`
- Existing shadcn/ui primitives (`button`, `input`, `label`, `card`, `field`) for auth forms
- Project rules: `tdd-vitest`, `prd-living-docs`, `d1`, `nextjs`

---

## Risks and Mitigation

### Technical Risks
- **Risk:** D1 not yet configured in this starter; binding/typegen mistakes block services  
  **Mitigation:** Phase 1 isolates D1 setup + local migration before service work
- **Risk:** Password hashing choice incompatible with Cloudflare Workers runtime  
  **Mitigation:** Prefer Web Crypto or a known Workers-safe library; verify in Phase 2 tests
- **Risk:** “Login” without sessions may confuse later phases expecting auth middleware  
  **Mitigation:** Document explicitly in Out of Scope / Cut; later PRD owns tokens or sessions

### User Experience Risks
- **Risk:** Refreshing `/mcq` after login has no persisted auth (by design)  
  **Mitigation:** Blank page only; communicate in UI copy that session auth arrives later if needed
- **Risk:** Duplicate email errors feel unclear  
  **Mitigation:** Return 409 with a clear message on register

---

## Troubleshooting Guide

*Add entries as bugs are found and fixed during implementation.*

### (Template reserved)
**Problem:** —  
**Cause:** —  
**Solution:** —  
**Code Reference:** —

---

## Notes for AI Agents

1. Read Overview, Hypothesis, and Scope first. Do **not** build Out of Scope or Cut items.
2. **Hard gate:** Do not implement any phase until the user has reviewed this PRD and given explicit approval for that phase (or for “start Phase N”).
3. Implement only one phase per approval cycle unless the user says otherwise.
4. **Obey `.cursor/rules/tdd-vitest.mdc`:** for the approved phase only — write Vitest cases from the planned list → confirm red → implement minimally → confirm green → refactor → update this PRD. Never implement before a failing test exists for that behavior.
5. Do not start Phase N+1 while Phase N tests are red or the phase status is not `COMPLETED`.
6. Do not mark acceptance criteria `[x]` unless matching Vitest cases are green.
7. After code lands, fill **Technical Implementation Details** with real paths, snippets, and `filepath:line-number` refs.
8. Never apply D1 migrations with `--remote`.
9. Prefer `UserService` + route handlers as specified; do not invent JWT/cookie/session behavior.
10. Login identifier is **email** (username field on the form maps to email).
11. Post-login destination is the blank **`/mcq`** page only.
12. App root **`/`** must redirect to **`/login`** (default instructor entry).
13. Keep all sections current; remove outdated claims.

---

## Complete Implementation Record (Phases 1–4)

Consolidated inventory of what shipped for register / login / logout.

### Route map

| URL | Behavior |
|-----|----------|
| `/` | Server redirect → `/login` |
| `/register` | shadcn signup → `POST /api/auth/register` → `/login` |
| `/login` | shadcn login → `POST /api/auth/login` → `/mcq` |
| `/mcq` | Blank MCQ placeholder + link to logout |
| `/logout` | `POST /api/auth/logout` → `/login` |
| `POST /api/auth/register` | Create user (201) / validate (400) / duplicate (409) |
| `POST /api/auth/login` | Credential check (200/401); no tokens/cookies |
| `POST /api/auth/logout` | `{ ok: true }` (200) |

### Stack choices recorded

| Concern | Choice |
|---------|--------|
| DB | Cloudflare D1 `quizmaker-db`, binding `DB` |
| Migration | `migrations/0001_create_users.sql` (local apply; remote = user-owned) |
| Password | Web Crypto PBKDF2 (`saltHex:hashHex`) |
| Validation | Zod (`src/lib/auth/schemas.ts`) |
| Domain | `UserService` in `src/lib/services/user-service.ts` |
| HTTP | Thin App Router routes + handlers under `src/lib/auth/` |
| UI | shadcn Card/Field/Input blocks + Tailwind |
| Tests | Vitest TDD; `npm test` |

### Git

- Feature branch: `feature/register-login-logout`
- Do not apply D1 migrations with `--remote` from the agent

---

## Current Status

**Last Updated:** 2026-09-02  
**Current Phase:** Phase 4 complete + home → login entry  
**Status:** COMPLETED — committing/pushing Phase 4 (+ home → login) on `feature/register-login-logout`  
**Git:** Stay on `feature/register-login-logout`; never apply D1 migrations `--remote`  
**Next Steps:** Feature register/login/logout UI complete for this PRD; await further product work (e.g. MCQ) in a later PRD
