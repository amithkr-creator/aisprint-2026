import { describe, expect, it, vi } from "vitest";
import {
	InvalidChoicesError,
	McqNotFoundError,
	type McqListItem,
	type McqRecord,
} from "@/lib/services/mcq-service";
import {
	handleCreateMcq,
	handleDeleteMcq,
	handleGetMcq,
	handleListMcqs,
	handleUpdateMcq,
} from "@/lib/mcq/handlers";

const listItem: McqListItem = {
	id: "mcq-1",
	name: "Addition warmup",
	question: "What is 2 + 2?",
	createdBy: "user-1",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const record: McqRecord = {
	...listItem,
	choices: [
		{ id: "c1", label: "3", isCorrect: false, sortOrder: 0 },
		{ id: "c2", label: "4", isCorrect: true, sortOrder: 1 },
	],
};

const validCreate = {
	name: "Addition warmup",
	question: "What is 2 + 2?",
	createdBy: "user-1",
	choices: [
		{ label: "3", isCorrect: false },
		{ label: "4", isCorrect: true },
	],
};

const validUpdate = {
	name: "Addition warmup",
	question: "What is 2 + 3?",
	choices: [
		{ label: "4", isCorrect: false },
		{ label: "5", isCorrect: true },
	],
};

describe("MCQ HTTP handlers", () => {
	it("lists MCQs and returns 200 items", async () => {
		const list = vi.fn().mockResolvedValue([listItem]);
		const response = await handleListMcqs({ list });

		expect(response.status).toBe(200);
		const body = (await response.json()) as { items: McqListItem[] };
		expect(body).toEqual({ items: [listItem] });
		expect(body.items[0]).not.toHaveProperty("choices");
	});

	it("returns 201 without unexpected fields on create", async () => {
		const create = vi.fn().mockResolvedValue(record);
		const response = await handleCreateMcq(validCreate, { create });

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body).toEqual(record);
		expect(body).not.toHaveProperty("created_by");
		expect(body).not.toHaveProperty("is_correct");
		expect(body).not.toHaveProperty("sort_order");
		expect(create).toHaveBeenCalledWith(validCreate);
	});

	it("returns 400 when create payload is invalid", async () => {
		const create = vi.fn();
		const response = await handleCreateMcq(
			{ name: "", question: "", createdBy: "", choices: [] },
			{ create },
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toMatchObject({ error: expect.any(String) });
		expect(create).not.toHaveBeenCalled();
	});

	it("returns 200 on update", async () => {
		const updated: McqRecord = {
			...record,
			question: validUpdate.question,
			choices: [
				{ id: "c3", label: "4", isCorrect: false, sortOrder: 0 },
				{ id: "c4", label: "5", isCorrect: true, sortOrder: 1 },
			],
		};
		const update = vi.fn().mockResolvedValue(updated);
		const response = await handleUpdateMcq("mcq-1", validUpdate, { update });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(updated);
		expect(update).toHaveBeenCalledWith("mcq-1", validUpdate);
	});

	it("returns 404 when updating a missing MCQ", async () => {
		const update = vi
			.fn()
			.mockRejectedValue(new McqNotFoundError("missing"));
		const response = await handleUpdateMcq("missing", validUpdate, { update });

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body).toMatchObject({ error: expect.any(String) });
	});

	it("returns 200 ok true on delete", async () => {
		const remove = vi.fn().mockResolvedValue(undefined);
		const response = await handleDeleteMcq("mcq-1", { delete: remove });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(remove).toHaveBeenCalledWith("mcq-1");
	});

	it("returns 404 when deleting a missing MCQ", async () => {
		const remove = vi
			.fn()
			.mockRejectedValue(new McqNotFoundError("missing"));
		const response = await handleDeleteMcq("missing", { delete: remove });

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body).toMatchObject({ error: expect.any(String) });
	});

	it("returns 200 with choices on get by id", async () => {
		const findById = vi.fn().mockResolvedValue(record);
		const response = await handleGetMcq("mcq-1", { findById });

		expect(response.status).toBe(200);
		const body = (await response.json()) as McqRecord;
		expect(body).toEqual(record);
		expect(body.choices).toHaveLength(2);
		expect(findById).toHaveBeenCalledWith("mcq-1");
	});

	it("returns 400 when the service rejects invalid choices", async () => {
		const create = vi.fn().mockRejectedValue(new InvalidChoicesError());
		const response = await handleCreateMcq(validCreate, { create });

		expect(response.status).toBe(400);
	});
});
