import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqNotFoundError } from "@/lib/services/mcq-service";
import { UserNotFoundError } from "@/lib/services/user-service";
import {
	AttemptService,
	ChoiceNotFoundError,
} from "./attempt-service";

type StatementResult = {
	results?: Array<Record<string, unknown>>;
	meta?: { changes: number };
};

function createMockDb() {
	const prepare = vi.fn();
	const db = { prepare } as unknown as D1Database;

	function mockStatement(result: StatementResult) {
		const bound = {
			run: vi.fn().mockResolvedValue({
				success: true,
				meta: result.meta ?? { changes: 1 },
			}),
			all: vi.fn().mockResolvedValue({
				results: result.results ?? [],
			}),
		};
		const statement = {
			bind: vi.fn().mockReturnValue(bound),
			run: bound.run,
			all: bound.all,
		};
		prepare.mockReturnValueOnce(statement);
		return { statement, bound };
	}

	return { db, prepare, mockStatement };
}

const correctChoice = {
	id: "choice-1",
	mcq_id: "mcq-1",
	label: "4",
	is_correct: 1,
};

const wrongChoice = {
	id: "choice-2",
	mcq_id: "mcq-1",
	label: "3",
	is_correct: 0,
};

describe("AttemptService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("records an attempt and snapshots is_correct from the choice", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new AttemptService(db);

		mockStatement({ results: [{ id: "mcq-1" }] });
		mockStatement({ results: [{ id: "user-1" }] });
		mockStatement({ results: [correctChoice] });
		mockStatement({ meta: { changes: 1 } });

		const attempt = await service.create("mcq-1", {
			userId: "user-1",
			choiceId: "choice-1",
		});

		expect(attempt).toMatchObject({
			mcqId: "mcq-1",
			userId: "user-1",
			choiceId: "choice-1",
			isCorrect: true,
		});
		expect(attempt.id).toBeTruthy();
		expect(attempt.createdAt).toBeTruthy();
	});

	it("records an incorrect attempt when the selected choice is wrong", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new AttemptService(db);

		mockStatement({ results: [{ id: "mcq-1" }] });
		mockStatement({ results: [{ id: "user-1" }] });
		mockStatement({ results: [wrongChoice] });
		mockStatement({ meta: { changes: 1 } });

		const attempt = await service.create("mcq-1", {
			userId: "user-1",
			choiceId: "choice-2",
		});

		expect(attempt.isCorrect).toBe(false);
	});

	it("fails when the MCQ does not exist", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new AttemptService(db);

		mockStatement({ results: [] });

		await expect(
			service.create("missing-mcq", {
				userId: "user-1",
				choiceId: "choice-1",
			}),
		).rejects.toBeInstanceOf(McqNotFoundError);
	});

	it("fails when the choice does not belong to the MCQ", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new AttemptService(db);

		mockStatement({ results: [{ id: "mcq-1" }] });
		mockStatement({ results: [{ id: "user-1" }] });
		mockStatement({ results: [] });

		await expect(
			service.create("mcq-1", {
				userId: "user-1",
				choiceId: "other-choice",
			}),
		).rejects.toBeInstanceOf(ChoiceNotFoundError);
	});

	it("fails when the user id does not exist", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new AttemptService(db);

		mockStatement({ results: [{ id: "mcq-1" }] });
		mockStatement({ results: [] });

		await expect(
			service.create("mcq-1", {
				userId: "missing-user",
				choiceId: "choice-1",
			}),
		).rejects.toBeInstanceOf(UserNotFoundError);
	});

	it("lists attempts for an MCQ newest first", async () => {
		const { db, mockStatement, prepare } = createMockDb();
		const service = new AttemptService(db);

		mockStatement({ results: [{ id: "mcq-1" }] });
		mockStatement({
			results: [
				{
					id: "a2",
					mcq_id: "mcq-1",
					user_id: "user-1",
					choice_id: "choice-1",
					is_correct: 1,
					created_at: "2026-01-02T00:00:00.000Z",
				},
				{
					id: "a1",
					mcq_id: "mcq-1",
					user_id: "user-1",
					choice_id: "choice-2",
					is_correct: 0,
					created_at: "2026-01-01T00:00:00.000Z",
				},
			],
		});

		const items = await service.listByMcqId("mcq-1");

		expect(items).toEqual([
			expect.objectContaining({
				id: "a2",
				mcqId: "mcq-1",
				isCorrect: true,
				createdAt: "2026-01-02T00:00:00.000Z",
			}),
			expect.objectContaining({
				id: "a1",
				isCorrect: false,
				createdAt: "2026-01-01T00:00:00.000Z",
			}),
		]);
		expect(prepare.mock.calls[1]?.[0]).toMatch(/ORDER BY created_at DESC/i);
	});
});
