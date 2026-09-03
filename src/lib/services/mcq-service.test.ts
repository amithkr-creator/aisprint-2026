import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserNotFoundError } from "@/lib/services/user-service";
import {
	InvalidChoicesError,
	McqNotFoundError,
	McqService,
} from "@/lib/services/mcq-service";

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

const validInput = {
	name: "Addition warmup",
	question: "What is 2 + 2?",
	createdBy: "user-1",
	choices: [
		{ label: "3", isCorrect: false },
		{ label: "4", isCorrect: true },
	],
};

const mcqRow = {
	id: "mcq-1",
	name: "Addition warmup",
	question: "What is 2 + 2?",
	created_by: "user-1",
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
};

describe("McqService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("creates an MCQ with name, question, createdBy, and returns choices", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [{ id: "user-1" }] });
		mockStatement({ meta: { changes: 1 } });
		mockStatement({ meta: { changes: 1 } });
		mockStatement({ meta: { changes: 1 } });

		const created = await service.create(validInput);

		expect(created).toMatchObject({
			name: "Addition warmup",
			question: "What is 2 + 2?",
			createdBy: "user-1",
		});
		expect(created.id).toBeTruthy();
		expect(created.choices).toHaveLength(2);
		expect(created.choices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: "3", isCorrect: false }),
				expect.objectContaining({ label: "4", isCorrect: true }),
			]),
		);
	});

	it("fails create when createdBy user does not exist", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [] });

		await expect(service.create(validInput)).rejects.toBeInstanceOf(
			UserNotFoundError,
		);
	});

	it("assigns sort_order from the submitted choice array", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [{ id: "user-1" }] });
		mockStatement({ meta: { changes: 1 } });
		const firstChoice = mockStatement({ meta: { changes: 1 } });
		const secondChoice = mockStatement({ meta: { changes: 1 } });

		await service.create(validInput);

		const firstBind = firstChoice.statement.bind.mock.calls[0] as unknown[];
		const secondBind = secondChoice.statement.bind.mock.calls[0] as unknown[];
		expect(firstBind).toContain(0);
		expect(secondBind).toContain(1);
	});

	it("rejects create when choice rules fail", async () => {
		const { db, prepare } = createMockDb();
		const service = new McqService(db);

		await expect(
			service.create({
				...validInput,
				choices: [{ label: "only-one", isCorrect: true }],
			}),
		).rejects.toBeInstanceOf(InvalidChoicesError);
		expect(prepare).not.toHaveBeenCalled();
	});

	it("lists MCQs without embedding choices", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [mcqRow] });

		const items = await service.list();

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			id: "mcq-1",
			name: "Addition warmup",
			question: "What is 2 + 2?",
			createdBy: "user-1",
		});
		expect(items[0]).not.toHaveProperty("choices");
	});

	it("finds an MCQ by id with choices", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [mcqRow] });
		mockStatement({
			results: [
				{
					id: "c1",
					mcq_id: "mcq-1",
					label: "3",
					is_correct: 0,
					sort_order: 0,
				},
				{
					id: "c2",
					mcq_id: "mcq-1",
					label: "4",
					is_correct: 1,
					sort_order: 1,
				},
			],
		});

		const found = await service.findById("mcq-1");

		expect(found).toMatchObject({
			id: "mcq-1",
			name: "Addition warmup",
			question: "What is 2 + 2?",
		});
		expect(found?.choices).toEqual([
			expect.objectContaining({ id: "c1", label: "3", isCorrect: false, sortOrder: 0 }),
			expect.objectContaining({ id: "c2", label: "4", isCorrect: true, sortOrder: 1 }),
		]);
	});

	it("updates an MCQ and replaces its choices", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [mcqRow] });
		mockStatement({ results: [] });
		const updateStmt = mockStatement({ meta: { changes: 1 } });
		const deleteChoices = mockStatement({ meta: { changes: 2 } });
		mockStatement({ meta: { changes: 1 } });
		mockStatement({ meta: { changes: 1 } });

		const updated = await service.update("mcq-1", {
			name: "Addition review",
			question: "What is 3 + 1?",
			choices: [
				{ label: "5", isCorrect: false },
				{ label: "4", isCorrect: true },
			],
		});

		expect(updated).toMatchObject({
			id: "mcq-1",
			name: "Addition review",
			question: "What is 3 + 1?",
		});
		expect(updated.choices).toHaveLength(2);
		expect(updateStmt.statement.bind).toHaveBeenCalled();
		expect(deleteChoices.statement.bind).toHaveBeenCalledWith("mcq-1");
	});

	it("deletes an existing MCQ by id", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [mcqRow] });
		mockStatement({ results: [] });
		mockStatement({ meta: { changes: 1 } });

		await expect(service.delete("mcq-1")).resolves.toBeUndefined();
	});

	it("fails update when MCQ id does not exist", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [] });

		await expect(
			service.update("missing-id", {
				name: "Nope",
				question: "Missing?",
				choices: validInput.choices,
			}),
		).rejects.toBeInstanceOf(McqNotFoundError);
	});

	it("fails delete when MCQ id does not exist", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new McqService(db);

		mockStatement({ results: [] });

		await expect(service.delete("missing-id")).rejects.toBeInstanceOf(
			McqNotFoundError,
		);
	});
});
