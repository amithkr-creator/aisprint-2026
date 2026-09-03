import { describe, expect, it, vi } from "vitest";
import { McqNotFoundError } from "@/lib/services/mcq-service";
import {
	ChoiceNotFoundError,
	type AttemptRecord,
} from "@/lib/services/attempt-service";
import { handleCreateAttempt, handleListAttempts } from "@/lib/mcq/attempts";

const attempt: AttemptRecord = {
	id: "att-1",
	mcqId: "mcq-1",
	userId: "user-1",
	choiceId: "c2",
	isCorrect: true,
	createdAt: "2026-01-01T00:00:00.000Z",
};

const validBody = {
	userId: "user-1",
	choiceId: "c2",
};

describe("attempt HTTP handlers", () => {
	it("records an attempt and returns 201", async () => {
		const create = vi.fn().mockResolvedValue(attempt);
		const response = await handleCreateAttempt("mcq-1", validBody, { create });

		expect(response.status).toBe(201);
		const body = (await response.json()) as AttemptRecord;
		expect(body).toEqual(attempt);
		expect(create).toHaveBeenCalledWith("mcq-1", validBody);
	});

	it("returns 400 when attempt payload is invalid", async () => {
		const create = vi.fn();
		const response = await handleCreateAttempt(
			"mcq-1",
			{ userId: "", choiceId: "" },
			{ create },
		);

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body).toMatchObject({ error: expect.any(String) });
		expect(create).not.toHaveBeenCalled();
	});

	it("returns 404 when the MCQ or choice is invalid", async () => {
		const missingMcq = await handleCreateAttempt("missing", validBody, {
			create: vi.fn().mockRejectedValue(new McqNotFoundError("missing")),
		});
		expect(missingMcq.status).toBe(404);

		const missingChoice = await handleCreateAttempt("mcq-1", validBody, {
			create: vi
				.fn()
				.mockRejectedValue(new ChoiceNotFoundError("c2", "mcq-1")),
		});
		expect(missingChoice.status).toBe(404);
	});

	it("lists attempts for an MCQ and returns 200", async () => {
		const listByMcqId = vi.fn().mockResolvedValue([attempt]);
		const response = await handleListAttempts("mcq-1", { listByMcqId });

		expect(response.status).toBe(200);
		const body = (await response.json()) as { items: AttemptRecord[] };
		expect(body).toEqual({ items: [attempt] });
		expect(listByMcqId).toHaveBeenCalledWith("mcq-1");
	});
});
