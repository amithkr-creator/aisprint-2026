Date created: 2026-09-04
Date last modified: 2026-09-04 (Phase 3 COMPLETED — Zod MCQ and attempt schemas)

# MCQ CRUD - Technical PRD

## Overview/Problem

After login, instructors land on a blank `/mcq` placeholder. That page has no app chrome, no question list, and no way to create, edit, preview, or delete multiple-choice questions. QuizMaker cannot store a question bank, answer choices, or student attempts, so instructors have nowhere to author items and later features have nothing to attach attempts to. This feature replaces the placeholder with a structured post-login shell and full MCQ authoring (list, create, edit, preview, delete), plus persistence for questions, choices, and attempts.

---

## Hypothesis

We believe that giving instructors a shadcn-structured question-bank UI backed by D1 tables, an `McqService` / `AttemptService`, and HTTP endpoints will let them create and manage multiple-choice questions (with 2–6 choices) and record per-question attempts so QuizMaker can grow from “logged-in empty page” into a usable item bank.

---

## Scope

### In Scope

- Replace the blank `/mcq` placeholder with a **post-login app shell** (sidebar + header + content) using shadcn/ui + Tailwind
- MCQ **list page** at `/mcq`: shadcn table of every question (**Name**, **Question**, **Actions**) + **Create** button
- Shared **create / edit page** (`/mcq/new` and `/mcq/[id]/edit`) with Save and Cancel
- Row **Actions** menu: vertical ellipsis (`MoreVertical`) that opens a dropdown with **Edit**, **Preview**, and **Delete**
- Three D1 tables: `mcqs`, `mcq_choices`, `mcq_attempts` (local migration only)
- `McqService` for question + choice persistence; `AttemptService` for recording and listing attempts
- HTTP endpoints for MCQ create / read / update / delete and for attempts on a given MCQ
- Default **two** choice fields on the form; instructor may add up to **six** choices
- Exactly **one** correct choice per question (`is_correct` on `mcq_choices`)
- Vitest unit tests per phase (TDD); green tests gate acceptance criteria
- Zod validation on all MCQ and attempt inputs

### Out of Scope

- Token-based auth, cookies, or session middleware (unchanged from register/login/logout — login still does not persist a server session)
- Per-instructor ownership / filtering of the list (we **store** `created_by`; we do not hide other instructors’ rows — no session to bind)
- Student-facing quiz-taking UI (attempts API exists; no “take quiz” page)
- Course catalog / course CRUD / a `course_name` column (removed in this revision)
- Bulk import, CSV, AI generation, TEKS alignment, rich-text / media in questions
- Soft-delete, versioning, publish/draft workflow, or sharing links
- Applying D1 migrations to the **remote** database (local apply only)

### Cut

- Session/cookie auth before MCQ APIs — cut so this feature can ship on the existing credential-only login; APIs are reachable without a server session, same as `/api/auth/*`
- `course_name` and `short_description` on `mcqs` — cut; the list shows **name** + **question** only
- Separate “Course” table — cut; no course domain in this feature
- More than six choices — cut to keep the form and validation simple
- Multiple correct answers — cut; classic single-key MCQ only
- Attempt analytics dashboards — cut; persist attempts only, no charts

---

## Technical Requirements

### Database Schema

Reuse existing D1 binding `DB` → `quizmaker-db`. Add a **new local migration** (do not edit `0001_create_users.sql`). Never apply with `--remote`.

**Field mapping (UI ↔ DB):**

| List / form label | `mcqs` column | Notes |
|-------------------|---------------|--------|
| Name | `name` | Short title for the item |
| Question | `question` | The actual MCQ stem (renamed from “description”) |
| — | `created_by` | Author `users.id`; stored, not shown as a list column |

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_mcqs_created_by ON mcqs (created_by);
CREATE INDEX idx_mcqs_updated_at ON mcqs (updated_at);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  label TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (choice_id) REFERENCES mcq_choices(id)
);

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts (user_id);
```

**Field notes:**
- `mcqs.id` — unique key (TEXT UUID-style from D1 `randomblob`)
- `mcqs.name` — short title shown in the list **Name** column
- `mcqs.question` — the actual question text shown in the list **Question** column (this is the renamed “description” field)
- `mcqs.created_by` — `users.id` of the author; required on create
- `mcq_choices.is_correct` — `0` or `1`; exactly one choice per MCQ must be `1`
- `mcq_choices.sort_order` — 0-based display order (0–5)
- `mcq_attempts.is_correct` — copied from the selected choice at attempt time (snapshot; not recomputed later)
- `mcq_attempts.user_id` — supplied by the client (no session); must reference `users.id`
- Deleting an MCQ cascades to its choices and attempts

**Migration workflow (local only):**
1. `npx wrangler d1 migrations create quizmaker-db create_mcq_tables`
2. Put the SQL above in the generated file
3. `npx wrangler d1 migrations apply quizmaker-db --local`
4. **Never** run `migrations apply` with `--remote`

---

### API Endpoints

Endpoints live under `src/app/api/`. They call `McqService` / `AttemptService`. No tokens, cookies, or sessions. Handlers stay thin; logic lives under `src/lib/mcq/` (same pattern as `src/lib/auth/`).

#### GET /api/mcqs

**Request Body:** none

**Behavior:** Return all MCQs newest-first (`updated_at DESC`). List payload does not include choices.

**Response:**
- Success (200): `{ "items": [ { "id", "name", "question", "createdBy", "createdAt", "updatedAt" } ] }`
- Error (500): server/database error

#### GET /api/mcqs/:id

**Behavior:** Return one MCQ with its choices (sorted by `sort_order`).

**Response:**
- Success (200): `{ "id", "name", "question", "createdBy", "createdAt", "updatedAt", "choices": [ { "id", "label", "isCorrect", "sortOrder" } ] }`
- Error (404): MCQ not found
- Error (500): server/database error

#### POST /api/mcqs

**Request Body:**
```json
{
  "name": "Addition warmup",
  "question": "What is 2 + 2?",
  "createdBy": "user-id-from-login",
  "choices": [
    { "label": "3", "isCorrect": false },
    { "label": "4", "isCorrect": true }
  ]
}
```

**Behavior:**
- Validate with Zod (required `name`, `question`, `createdBy`; 2–6 choices; exactly one `isCorrect: true`; each label non-empty)
- `McqService.create` writes `mcqs` + `mcq_choices` in one operation; `created_by` must reference an existing `users.id`

**Response:**
- Success (201): full MCQ + choices (same shape as GET by id)
- Error (400): validation failure
- Error (500): server/database error

#### PUT /api/mcqs/:id

**Request Body:** `{ "name", "question", "choices" }` — same choice rules as POST. Do **not** change `createdBy` on update.

**Behavior:** Replace `name`, `question`, and **replace all choices** for that MCQ (delete existing choices, insert the new set). Zod: required `name` + `question`; 2–6 choices; exactly one correct.

**Response:**
- Success (200): full MCQ + choices
- Error (400): validation failure
- Error (404): MCQ not found
- Error (500): server/database error

#### DELETE /api/mcqs/:id

**Request Body:** none

**Behavior:** Delete the MCQ; choices and attempts cascade.

**Response:**
- Success (200): `{ "ok": true }`
- Error (404): MCQ not found
- Error (500): server/database error

#### POST /api/mcqs/:id/attempts

**Request Body:**
```json
{
  "userId": "instructor-or-student-id",
  "choiceId": "choice-row-id"
}
```

**Behavior:**
- Validate `userId` and `choiceId`
- Confirm the MCQ exists and the choice belongs to that MCQ
- Persist `is_correct` from the choice’s `is_correct` at write time

**Response:**
- Success (201): `{ "id", "mcqId", "userId", "choiceId", "isCorrect", "createdAt" }`
- Error (400): validation failure
- Error (404): MCQ or choice not found / choice not on this MCQ
- Error (500): server/database error

#### GET /api/mcqs/:id/attempts

**Behavior:** List attempts for that MCQ, newest first.

**Response:**
- Success (200): `{ "items": [ { "id", "mcqId", "userId", "choiceId", "isCorrect", "createdAt" } ] }`
- Error (404): MCQ not found
- Error (500): server/database error

---

### User Interface Requirements

Auth pages (`/login`, `/register`, `/logout`) stay as centered cards. Only `/mcq` and nested MCQ routes use the app shell.

#### App shell (`src/app/(app)/layout.tsx`)

- shadcn **Sidebar** (add `@shadcn/sidebar` if missing)
- Brand: “QuizMaker”
- Nav item: **Questions** → `/mcq`
- Footer / header action: **Log out** → `/logout` (`buttonVariants` / `Button`)
- Content area: page title + children
- Tailwind layout tokens only (`bg-background`, `text-foreground`, `text-muted-foreground`)

#### MCQ list (`/mcq`)

- Page title: “Multiple choice questions”
- Primary **Create** button → `/mcq/new`
- shadcn **Table** listing every MCQ. Columns:
  1. **Name** (`name`)
  2. **Question** (`question`)
  3. **Actions** (vertical ellipses dropdown)
- Empty state: short muted copy + Create button
- Actions column: icon button with **three vertical ellipses** (`MoreVertical` from Lucide)
- Clicking the icon opens a shadcn **Dropdown Menu** (`@shadcn/dropdown-menu`) **above** the trigger when space allows (`side="top"`)
- Menu items:
  - **Edit** → `/mcq/[id]/edit`
  - **Preview** → opens preview dialog (does not navigate away)
  - **Delete** → opens confirm dialog, then `DELETE /api/mcqs/:id`, refresh list

#### Preview dialog

- shadcn **Dialog**
- Shows **name**, **question**, and all choice labels
- Instructor preview may mark the correct choice (authoring aid)
- Close control only (no Save)

#### Delete confirm

- shadcn **Alert Dialog** (`@shadcn/alert-dialog`)
- Confirm / Cancel; Confirm calls delete endpoint

#### Create / Edit (`/mcq/new`, `/mcq/[id]/edit`)

- Same form component; edit loads `GET /api/mcqs/:id`
- Fields (shadcn `Field` / `Input` / `Textarea`):
  - **Name** (required) — short title
  - **Question** (required, textarea) — the actual MCQ stem
  - Choices: start with **two** rows; **Add choice** enabled while count &lt; 6; each row has label + radio for “Correct”
  - `createdBy` is sent on create from the client-held user id (login response); not a visible form field
- **Save** → `POST /api/mcqs` or `PUT /api/mcqs/:id` → on success navigate to `/mcq`
- **Cancel** → navigate to `/mcq` without saving
- Client-side + API validation: 2–6 choices, exactly one correct, non-empty labels

**shadcn primitives to add when a phase needs them** (always `@shadcn/` namespace):

| Need | Add |
|------|-----|
| App chrome | `@shadcn/sidebar` |
| Row actions | `@shadcn/dropdown-menu` |
| Preview | `@shadcn/dialog` (already present — reuse) |
| Delete confirm | `@shadcn/alert-dialog` |
| Question stem | `@shadcn/textarea` |
| Correct choice | `@shadcn/radio-group` |
| Already installed | `button`, `input`, `label`, `card`, `field`, `table`, `separator`, `badge` |

---

### Services

Located under `src/lib/services/`. D1 via constructor injection (`new McqService(db)`), same as `UserService`. Prepared statements with `?1`, `?2`, ….

#### McqService

| Method | Responsibility |
|--------|----------------|
| `list()` | All MCQs, `updated_at DESC`, no choices |
| `findById(id)` | MCQ + choices or `null` |
| `create(input)` | Insert MCQ + choices; persist `created_by`; assign `sort_order` |
| `update(id, input)` | Update MCQ; replace choices; fail if missing |
| `delete(id)` | Delete MCQ (cascade); fail if missing |

Domain errors: `McqNotFoundError`, `InvalidChoicesError` (wrong count or not exactly one correct), `UserNotFoundError` when `created_by` is not a real user.

#### AttemptService

| Method | Responsibility |
|--------|----------------|
| `create(mcqId, { userId, choiceId })` | Snapshot `is_correct`; fail if MCQ/choice invalid |
| `listByMcqId(mcqId)` | Attempts for that question; fail if MCQ missing |

Domain errors: `McqNotFoundError`, `ChoiceNotFoundError`, `UserNotFoundError` (reuse or mirror user-service error).

---

## Implementation Phases

**Approval gate:** Do **not** implement any phase until the human reviewer has approved this PRD (or explicitly approved that phase).

**TDD mandate (from `.cursor/rules/tdd-vitest.mdc`):** Every phase below follows the same loop. Do not skip steps.

1. Read this PRD — phase objective + mapped acceptance criteria
2. Write Vitest tests first (phase scope only) — encode AC as behavior names
3. Confirm **red** — `npm test`; new tests must fail
4. Implement minimally — only what turns those tests green
5. Confirm **green** — phase + all prior phase tests pass
6. Refactor if needed — stay green; no scope creep
7. Update this PRD — phase `COMPLETED`, check AC covered by green tests, record files/snippets

**Phase gate:** Do not start Phase N+1 until Phase N’s Vitest suite is green and this PRD marks that phase `COMPLETED`, plus explicit user go-ahead.

**Test design rules for this feature:**
- Prefer pure logic under `src/lib/` (routes, schemas, services, handlers, form/list helpers)
- Mock D1 and services at boundaries; assert outcomes, not only “mock was called”
- Colocate `*.test.ts` next to the module
- Name tests after behavior, e.g. `it('rejects create when fewer than two choices are provided')`

---

### Phase 1: Post-login app shell + MCQ routes - COMPLETED

**Objective:** After login, instructors see a structured QuizMaker shell (sidebar + header) instead of a blank placeholder. Auth pages stay unchanged.

**Acceptance criteria mapped:**
- `/mcq` is no longer a “coming soon” blank page; it sits inside an app shell
- Named routes exist for list, create, and edit
- Logout remains reachable from the shell

**TDD cycle:**

| Step | Action |
|------|--------|
| Red | ✅ Wrote `src/lib/mcq/navigation.test.ts` (module missing). Confirmed red (`Cannot find package '@/lib/mcq/navigation'`). |
| Green | ✅ Implemented `src/lib/mcq/navigation.ts`. Suite green (`6` Phase 1 + prior auth tests). Full run: `Test Files 9 passed` · `Tests 40 passed`. |
| UI | ✅ Added `@shadcn/sidebar` (+ tooltip, sheet, skeleton). App group layout with sidebar + header. Moved `/mcq` off the blank placeholder. |
| PRD | ✅ Recorded paths/snippets below; Phase 1 marked `COMPLETED`. |

**Vitest cases** (`src/lib/mcq/navigation.test.ts`) — all green:

- `it('lists MCQs at /mcq')`
- `it('opens create at /mcq/new')`
- `it('opens edit at /mcq/:id/edit')`
- `it('returns to the list after save')`
- `it('returns to the list after cancel')`
- `it('keeps logout at /logout from the app shell')`

**Tasks:**
1. [x] Write the navigation tests (red)
2. [x] Add `src/lib/mcq/navigation.ts` route helpers
3. [x] Add shadcn Sidebar; introduce `src/app/(app)/layout.tsx`
4. [x] Move `/mcq` into the app group; replace placeholder copy with a titled shell (empty table comes in Phase 8)
5. [x] Confirm green; record paths in this PRD

**Deliverables:** `src/lib/mcq/navigation.ts` + test, `(app)` layout, `/mcq` + `/mcq/new` + `/mcq/[id]/edit` titled pages, `src/components/app-sidebar.tsx`

**Depends on:** PRD / Phase 1 approval

---

### Phase 2: D1 migration for mcqs, choices, attempts - COMPLETED

**Objective:** Local D1 schema exists for the three tables with FKs, indexes, and timestamps.

**Acceptance criteria mapped:**
- Migration creates `mcqs`, `mcq_choices`, `mcq_attempts` with required columns
- Cascade delete from `mcqs` to choices and attempts is declared

**TDD cycle:**

| Step | Action |
|------|--------|
| Red | ✅ Wrote `migrations/mcq-schema.test.ts` (5 cases). Confirmed red (`expected a create_mcq_tables migration .sql file`). |
| Green | ✅ `wrangler d1 migrations create quizmaker-db create_mcq_tables` → `0002_create_mcq_tables.sql`. Applied `--local` only. Suite green (`5` Phase 2). Full run: `Test Files 10 passed` · `Tests 45 passed`. |
| PRD | ✅ Recorded path/SQL below; Phase 2 marked `COMPLETED`. |

**Vitest cases** (`migrations/mcq-schema.test.ts`) — all green:

- `it('ships an mcq tables migration file')`
- `it('defines mcqs with id, name, question, created_by, and timestamps')`
- `it('defines mcq_choices with mcq_id foreign key and is_correct')`
- `it('defines mcq_attempts with mcq_id, user_id, choice_id, and is_correct')`
- `it('cascades deletes from mcqs to choices and attempts')`

**Tasks:**
1. [x] Write schema contract tests (red)
2. [x] `wrangler d1 migrations create quizmaker-db create_mcq_tables`
3. [x] Write SQL; apply `--local` only
4. [x] Confirm green; record migration path

**Deliverables:** `migrations/0002_create_mcq_tables.sql`, `migrations/mcq-schema.test.ts`

**Depends on:** Phase 1 `COMPLETED` + Phase 2 go-ahead

---

### Phase 3: Zod schemas for MCQ and attempts - COMPLETED

**Objective:** Shared validation rules for create/update payloads and attempt payloads.

**Acceptance criteria mapped:**
- 2–6 choices; exactly one correct; required `name` + `question` + `createdBy` on create
- Attempt requires `userId` + `choiceId`

**TDD cycle:**

| Step | Action |
|------|--------|
| Red | ✅ Wrote `src/lib/mcq/schemas.test.ts` (module missing). Confirmed red (`Cannot find package '@/lib/mcq/schemas'`). |
| Green | ✅ Implemented `createMcqSchema`, `updateMcqSchema`, `attemptSchema`. Full run: `Test Files 11 passed` · `Tests 54 passed`. |
| PRD | ✅ Recorded paths/snippets below; Phase 3 marked `COMPLETED`. |

**Vitest cases** (`src/lib/mcq/schemas.test.ts`) — all green:

- `it('accepts a valid MCQ payload with two choices and one correct')`
- `it('rejects MCQ when name or question is empty')`
- `it('rejects create when createdBy is missing')`
- `it('rejects MCQ when fewer than two choices are provided')`
- `it('rejects MCQ when more than six choices are provided')`
- `it('rejects MCQ when zero or more than one choice is correct')`
- `it('rejects a choice with an empty label')`
- `it('accepts a valid attempt payload')`
- `it('rejects attempt when userId or choiceId is missing')`

**Tasks:**
1. [x] Write schema tests (red)
2. [x] Implement `src/lib/mcq/schemas.ts`
3. [x] Confirm green

**Deliverables:** `src/lib/mcq/schemas.ts`, `src/lib/mcq/schemas.test.ts`

**Depends on:** Phase 2 `COMPLETED` + Phase 3 go-ahead

---

### Phase 4: McqService (CRUD + choices) - PLANNED

**Objective:** Domain layer can list, read, create, update, and delete MCQs and persist 2–6 choices.

**Acceptance criteria mapped:**
- Create/update persist choices with `sort_order` and exactly one correct
- Update replaces the choice set
- Delete / missing id fail clearly
- List does not embed choices

**Planned Vitest cases** (`src/lib/services/mcq-service.test.ts`) — mock D1:

- `it('creates an MCQ with name, question, createdBy, and returns choices')`
- `it('fails create when createdBy user does not exist')`
- `it('assigns sort_order from the submitted choice array')`
- `it('rejects create when choice rules fail')`
- `it('lists MCQs without embedding choices')`
- `it('finds an MCQ by id with choices')`
- `it('updates an MCQ and replaces its choices')`
- `it('deletes an existing MCQ by id')`
- `it('fails update when MCQ id does not exist')`
- `it('fails delete when MCQ id does not exist')`

**Tasks:**
1. Write service tests (red)
2. Implement `src/lib/services/mcq-service.ts`
3. Confirm green

**Deliverables:** `McqService` + colocated tests

**Depends on:** Phase 3 `COMPLETED` + Phase 4 go-ahead

---

### Phase 5: AttemptService - PLANNED

**Objective:** Record a student’s selected choice and whether it was correct; list attempts per MCQ.

**Acceptance criteria mapped:**
- Attempt stores `is_correct` from the selected choice
- Invalid MCQ / choice / user is rejected
- List returns attempts for that MCQ

**Planned Vitest cases** (`src/lib/services/attempt-service.test.ts`):

- `it('records an attempt and snapshots is_correct from the choice')`
- `it('records an incorrect attempt when the selected choice is wrong')`
- `it('fails when the MCQ does not exist')`
- `it('fails when the choice does not belong to the MCQ')`
- `it('fails when the user id does not exist')`
- `it('lists attempts for an MCQ newest first')`

**Tasks:**
1. Write service tests (red)
2. Implement `src/lib/services/attempt-service.ts`
3. Confirm green

**Deliverables:** `AttemptService` + colocated tests

**Depends on:** Phase 4 `COMPLETED` + Phase 5 go-ahead

---

### Phase 6: MCQ HTTP endpoints - PLANNED

**Objective:** Thin App Router routes call extracted handlers + `McqService` for list/get/create/update/delete.

**Acceptance criteria mapped:**
- GET list / GET by id / POST / PUT / DELETE behaviors and status codes above
- 400 on Zod failure; 404 on missing; no D1 SQL in route files

**Planned Vitest cases** (`src/lib/mcq/handlers.test.ts` or split `create.test.ts` / `update.test.ts` / …):

- `it('lists MCQs and returns 200 items')`
- `it('returns 201 without unexpected fields on create')`
- `it('returns 400 when create payload is invalid')`
- `it('returns 200 on update')`
- `it('returns 404 when updating a missing MCQ')`
- `it('returns 200 ok true on delete')`
- `it('returns 404 when deleting a missing MCQ')`
- `it('returns 200 with choices on get by id')`

**Tasks:**
1. Write handler tests (red)
2. Implement handlers under `src/lib/mcq/` + routes under `src/app/api/mcqs/`
3. Confirm green

**Deliverables:** handlers, `src/app/api/mcqs/route.ts`, `src/app/api/mcqs/[id]/route.ts`

**Depends on:** Phase 4 `COMPLETED` + Phase 6 go-ahead (Phase 5 may run before or after; do not start this phase until Phase 4 is done)

---

### Phase 7: Attempts HTTP endpoints - PLANNED

**Objective:** Record and list attempts for a specific MCQ.

**Acceptance criteria mapped:**
- `POST /api/mcqs/:id/attempts` → 201 with snapshot
- `GET /api/mcqs/:id/attempts` → 200 items
- 404 when MCQ/choice invalid

**Planned Vitest cases** (`src/lib/mcq/attempts.test.ts`):

- `it('records an attempt and returns 201')`
- `it('returns 400 when attempt payload is invalid')`
- `it('returns 404 when the MCQ or choice is invalid')`
- `it('lists attempts for an MCQ and returns 200')`

**Tasks:**
1. Write handler tests (red)
2. Implement `src/app/api/mcqs/[id]/attempts/route.ts`
3. Confirm green

**Deliverables:** attempt handlers + route

**Depends on:** Phase 5 `COMPLETED` + Phase 6 `COMPLETED` + Phase 7 go-ahead

---

### Phase 8: List page table + actions menu - PLANNED

**Objective:** `/mcq` shows a shadcn table of MCQs, a Create button, and a top-opening kebab menu (Edit / Preview / Delete).

**Acceptance criteria mapped:**
- Table columns: name, question, actions
- Create navigates to `/mcq/new`
- Kebab opens dropdown with Edit, Preview, Delete
- Preview dialog and delete confirm are wired

**Planned Vitest cases** (`src/lib/mcq/list-ui.test.ts`):

- `it('defines table columns as name, question, and actions')`
- `it('sends create to /mcq/new')`
- `it('exposes edit, preview, and delete row actions')`
- `it('sends edit to /mcq/:id/edit')`
- `it('maps delete success to a list refresh')`
- `it('maps delete 404 to a user-visible missing-question message')`

**Tasks:**
1. Write list-helper tests (red)
2. Implement helpers + list UI (`Table`, `DropdownMenu`, dialogs)
3. Fetch `GET /api/mcqs` from the list page
4. Confirm green; smoke the empty and populated table

**Deliverables:** list helpers, `/mcq` table UI, kebab menu, preview + delete dialogs

**Depends on:** Phase 1 + Phase 6 `COMPLETED` + Phase 8 go-ahead

---

### Phase 9: Create / edit form (Save + Cancel) - PLANNED

**Objective:** Instructors can create and edit a question with 2–6 choices and one correct answer.

**Acceptance criteria mapped:**
- Form defaults to two choices; Add choice up to six
- Save posts/puts then returns to `/mcq`
- Cancel returns to `/mcq` without saving
- Edit pre-fills from GET by id

**Planned Vitest cases** (`src/lib/mcq/form-ui.test.ts`):

- `it('starts the form with two empty choices')`
- `it('allows adding a choice until there are six')`
- `it('does not add a seventh choice')`
- `it('requires name and question before save is valid')`
- `it('requires exactly one correct choice before save is valid')`
- `it('sends successful save back to /mcq')`
- `it('sends cancel back to /mcq')`
- `it('maps 400 validation errors to field messages')`

**Tasks:**
1. Write form-helper tests (red)
2. Implement form helpers + shared form component (Field, Textarea, RadioGroup)
3. Wire `/mcq/new` and `/mcq/[id]/edit`
4. Confirm green; smoke create → list → edit → save → cancel

**Deliverables:** form helpers, create/edit pages, Save/Cancel actions

**Depends on:** Phase 8 `COMPLETED` + Phase 9 go-ahead

---

## Technical Implementation Details

### Key Files

#### Implemented (Phase 1)

| Path | Purpose |
|------|---------|
| `src/lib/mcq/navigation.ts` | List / create / edit / save / cancel / logout route helpers |
| `src/lib/mcq/navigation.test.ts` | Phase 1 route contract tests (TDD) |
| `src/components/app-sidebar.tsx` | QuizMaker brand, Questions nav, Log out |
| `src/app/(app)/layout.tsx` | Sidebar + header shell (auth pages excluded) |
| `src/app/(app)/mcq/page.tsx` | Titled list shell + Create link (table in Phase 8) |
| `src/app/(app)/mcq/new/page.tsx` | Create route stub (form in Phase 9) |
| `src/app/(app)/mcq/[id]/edit/page.tsx` | Edit route stub (form in Phase 9) |
| `src/components/ui/sidebar.tsx` | shadcn Sidebar primitive (`npx shadcn add @shadcn/sidebar`) |
| `src/components/ui/tooltip.tsx` | Sidebar tooltip dependency |
| `src/components/ui/sheet.tsx` | Mobile sidebar sheet |
| `src/components/ui/skeleton.tsx` | Sidebar skeleton |
| `src/hooks/use-mobile.ts` | Sidebar mobile breakpoint |

Removed: `src/app/mcq/page.tsx` (blank “coming soon” placeholder).

#### Implemented (Phase 2)

| Path | Purpose |
|------|---------|
| `migrations/0002_create_mcq_tables.sql` | Local D1: `mcqs`, `mcq_choices`, `mcq_attempts` + indexes/FKs |
| `migrations/mcq-schema.test.ts` | Phase 2 schema contract tests (TDD) |

#### `migrations/0002_create_mcq_tables.sql` — three-table schema
```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```
**Ref**: `migrations/0002_create_mcq_tables.sql:3-42` · **Phase**: 2 · **AC**: `mcqs` / choices / attempts columns, FKs, cascade

Applied locally: `npx wrangler d1 migrations apply quizmaker-db --local` (`0002_create_mcq_tables.sql` ✅). Not applied `--remote`.

#### Implemented (Phase 3)

| Path | Purpose |
|------|---------|
| `src/lib/mcq/schemas.ts` | Zod create/update/attempt validation |
| `src/lib/mcq/schemas.test.ts` | Phase 3 validation contract tests (TDD) |

#### `src/lib/mcq/schemas.ts` — create + attempt rules
```typescript
export const createMcqSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  question: z.string().trim().min(1, "Question is required"),
  createdBy: z.string().trim().min(1, "createdBy is required"),
  choices: choicesSchema, // 2–6 items, exactly one isCorrect
});

export const attemptSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  choiceId: z.string().trim().min(1, "choiceId is required"),
});
```
**Ref**: `src/lib/mcq/schemas.ts:1-38` · **Phase**: 3 · **AC**: choice count, one correct, required name/question/createdBy, attempt ids

`updateMcqSchema` is the same as create without `createdBy`.

#### Planned (later phases)

| Path | Purpose | Phase |
|------|---------|-------|
| `src/lib/services/mcq-service.ts` | Question + choice persistence | 4 |
| `src/lib/services/attempt-service.ts` | Attempt persistence | 5 |
| `src/lib/mcq/*` handlers | Testable HTTP logic | 6–7 |
| `src/app/api/mcqs/**` | Thin routes | 6–7 |

#### `src/lib/mcq/navigation.ts` — MCQ route helpers
```typescript
export const MCQ_ROUTES = {
  list: "/mcq",
  create: "/mcq/new",
  logout: "/logout",
  afterSave: "/mcq",
  afterCancel: "/mcq",
} as const;

export function mcqEditPath(id: string): string {
  return `/mcq/${id}/edit`;
}
```
**Ref**: `src/lib/mcq/navigation.ts:1-31` · **Phase**: 1 · **AC**: named routes for list, create, edit, logout

#### `src/app/(app)/layout.tsx` — post-login shell
SidebarProvider + AppSidebar + header (SidebarTrigger, QuizMaker, Log out). Auth routes stay outside `(app)`.
**Ref**: `src/app/(app)/layout.tsx:1-42` · **Phase**: 1 · **AC**: `/mcq` inside shadcn app shell

### Implementation Patterns

Follow the existing auth pattern:

```typescript
// Thin route — logic stays in src/lib/mcq/*
export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const service = await createMcqService();
  return handleCreateMcq(body, service);
}
```

```typescript
// Service — numbered D1 placeholders, constructor-injected db
await this.db
  .prepare(
    `INSERT INTO mcqs (id, name, question, created_by, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
  .bind(id, input.name, input.question, input.createdBy, now, now)
  .run();
```

### Decisions

- **`name` vs `question`:** `name` is the short title. `question` is the actual stem (the spoken “description” field, renamed).
- **`created_by`:** stored on every MCQ. List is not filtered by author (no session). Create API requires `createdBy`.
- **`course_name` / `short_description` removed** in the 2026-09-04 revision.
- **No server session:** inherited from [register / login / logout](register_login_logout_PRD.md). Attempt `userId` and create `createdBy` are request fields.
- **Choice replace-on-update:** simpler than patching individual choice rows; attempt FKs to old choice ids may dangle if we ever edit after attempts exist — documented as a known limitation.
- **Preview is a dialog**, not a route, so the kebab “Preview” action does not leave the list.
- **Kebab menu `side="top"`** so the menu opens upward as requested.
- **Route group `(app)`** so login/register/logout stay centered cards and only `/mcq/*` gets the sidebar.

### Important Notes

- Centralize DB access in services; route handlers do not embed raw SQL
- D1 only from server code; never import DB modules into `'use client'` components
- Prefer numbered SQL placeholders (`?1`, `?2`)
- No remote migration apply during agent work
- Living PRD rule: after each approved phase lands, record real paths, snippets, and test evidence here
- Do not invent custom controls when a shadcn primitive exists

### Tests (TDD plan ↔ acceptance criteria)

| Phase | Test files | Status | AC unlocked when green |
|-------|------------|--------|------------------------|
| 1 | `src/lib/mcq/navigation.test.ts` | ✅ 6/6 green | App shell routes |
| 2 | `migrations/mcq-schema.test.ts` | ✅ 5/5 green | Three-table schema |
| 3 | `src/lib/mcq/schemas.test.ts` | ✅ 9/9 green | Zod choice/attempt rules |
| 4 | `src/lib/services/mcq-service.test.ts` | ☐ planned | McqService CRUD |
| 5 | `src/lib/services/attempt-service.test.ts` | ☐ planned | AttemptService |
| 6 | `src/lib/mcq/` handler tests | ☐ planned | MCQ HTTP API |
| 7 | `src/lib/mcq/attempts.test.ts` | ☐ planned | Attempts HTTP API |
| 8 | `src/lib/mcq/list-ui.test.ts` | ☐ planned | Table + kebab actions |
| 9 | `src/lib/mcq/form-ui.test.ts` | ☐ planned | Create/edit form |

---

## Acceptance Criteria

- [x] After login, `/mcq` is shown inside a shadcn app shell (sidebar + header + logout), not a blank “coming soon” page *(Phase 1 — Vitest green + titled shell)*
- [x] Local D1 migration creates `mcqs`, `mcq_choices`, and `mcq_attempts` with the columns, FKs, and timestamps in this PRD *(Phase 2 — Vitest green; applied `--local` only)*
- [x] Create/update reject fewer than 2 or more than 6 choices, empty labels, and anything other than exactly one correct choice *(Phase 3 Zod green; service/HTTP still Phases 4 and 6)*
- [ ] `McqService` can list, get, create, update, and delete MCQs; update replaces choices; missing ids fail *(Phase 4)*
- [ ] `AttemptService` records `userId`, `choiceId`, and a snapshot of whether that choice was correct *(Phase 5)*
- [ ] HTTP: `GET/POST /api/mcqs`, `GET/PUT/DELETE /api/mcqs/:id` use the service layer and documented status codes *(Phase 6)*
- [ ] HTTP: `GET/POST /api/mcqs/:id/attempts` record and list attempts *(Phase 7)*
- [ ] List table shows **name**, **question**, and an actions kebab (vertical ellipses) with Edit, Preview, Delete *(Phase 8)*
- [x] `mcqs` columns are `id`, `name`, `question`, `created_by`, `created_at`, `updated_at` — no `course_name` or `short_description` *(Phase 2 — Vitest green)*
- [ ] Create button goes to `/mcq/new`; Edit goes to `/mcq/:id/edit`; Preview opens a dialog; Delete confirms then removes the row *(Phases 8–9)*
- [ ] Create/edit form defaults to two choices, allows up to six, and has Save (persist + return to list) and Cancel (return without save) *(Phase 9)*
- [ ] Each implemented phase has Vitest coverage that was red before implementation and green after; criteria are only checked when matching tests are green

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Instructor can create an MCQ | 100% of valid Save actions persist MCQ + 2–6 choices | Vitest + manual create |
| List is usable after login | Table (or empty state) visible in the app shell in one navigation | Manual walkthrough |
| Choice rules held | Invalid choice sets never persist | Zod + McqService tests |
| Attempt correctness | Stored `isCorrect` matches the selected choice | AttemptService tests |
| Scope discipline | No session auth, no student quiz UI, no remote migration | PRD Out of Scope + review |

---

## Dependencies

### External Dependencies

- Cloudflare D1 — `quizmaker-db`, binding `DB` (already configured)
- Wrangler — local migrations
- Vitest — `npm test`
- Zod — already in the project (`zod@4`)
- shadcn/ui (Base UI, `base-nova`) + Tailwind v4 + Lucide

### Internal Dependencies

- Completed register / login / logout feature ([`register_login_logout_PRD.md`](register_login_logout_PRD.md))
- `UserService` / `users` table — `mcqs.created_by` and attempt `user_id` FKs
- `getCloudflareContext()` for `env.DB`
- Existing UI: `button`, `input`, `field`, `card`, `table`, `dialog`
- Project rules: `tdd-vitest`, `prd-living-docs`, `d1`, `shadcn`, `tailwind`, `nextjs`

### New shadcn components (add per phase, ask before extra npm packages)

- `@shadcn/sidebar` — added in Phase 1 (also installed `tooltip`, `sheet`, `skeleton`)
- Still to add: `@shadcn/dropdown-menu`, `@shadcn/textarea`, `@shadcn/radio-group`, `@shadcn/alert-dialog`

No new npm libraries were required for the sidebar add.

---

## Risks and Mitigation

### Technical Risks

- **Risk:** Login still has no session, so MCQ APIs are unauthenticated  
  **Mitigation:** Document in Cut/Out of Scope; same model as current auth APIs; later PRD owns sessions
- **Risk:** Replacing choices on update can orphan `mcq_attempts.choice_id` if attempts already exist  
  **Mitigation:** Known limitation; do not rewrite historical `is_correct`; optional later work to block edit after attempts
- **Risk:** SQLite FK enforcement depends on `PRAGMA foreign_keys`  
  **Mitigation:** Declare FKs in SQL; service layer also validates parent rows before insert
- **Risk:** Sidebar / dropdown-menu names missing from the Base UI registry  
  **Mitigation:** Use `@shadcn/` add; if a name is missing, pick the registry equivalent — do not hand-roll

### User Experience Risks

- **Risk:** Refreshing `/mcq` after login has no persisted auth (by design)  
  **Mitigation:** Shell still renders; data APIs remain open in this phase
- **Risk:** Kebab menu clipped at the bottom of the table  
  **Mitigation:** Open the menu upward (`side="top"`)
- **Risk:** Instructors add six empty choice rows  
  **Mitigation:** Zod + field errors on empty labels

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
9. Prefer `McqService` / `AttemptService` + extracted handlers; do not invent JWT/cookie/session behavior.
10. Post-login destination remains **`/mcq`** (`AUTH_ROUTES.afterLogin`).
11. Auth pages must **not** receive the app sidebar.
12. Use shadcn primitives + Tailwind tokens only; add missing components with `npx shadcn@latest add @shadcn/<name>`.
13. Keep all sections current; remove outdated claims.

---

## Current Status

**Last Updated:** 2026-09-04  
**Current Phase:** Phase 3 complete  
**Status:** COMPLETED — Zod create/update/attempt schemas; Vitest `54 passed`  
**Git:** `feature/mcq-crud`  
**Next Steps:** Await go-ahead for **Phase 4** (`McqService` CRUD + choices). Do not start Phase 4 until approved.
