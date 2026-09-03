import { describe, expect, it } from "vitest";
import { attemptSchema, createMcqSchema } from "./schemas";

const validChoices = [
	{ label: "3", isCorrect: false },
	{ label: "4", isCorrect: true },
];

const validCreate = {
	name: "Addition warmup",
	question: "What is 2 + 2?",
	createdBy: "user-1",
	choices: validChoices,
};

describe("mcq schemas", () => {
	it("accepts a valid MCQ payload with two choices and one correct", () => {
		const result = createMcqSchema.safeParse(validCreate);
		expect(result.success).toBe(true);
	});

	it("rejects MCQ when name or question is empty", () => {
		expect(
			createMcqSchema.safeParse({ ...validCreate, name: "   " }).success,
		).toBe(false);
		expect(
			createMcqSchema.safeParse({ ...validCreate, question: "" }).success,
		).toBe(false);
	});

	it("rejects create when createdBy is missing", () => {
		const { createdBy: _createdBy, ...withoutAuthor } = validCreate;
		expect(createMcqSchema.safeParse(withoutAuthor).success).toBe(false);
	});

	it("rejects MCQ when fewer than two choices are provided", () => {
		const result = createMcqSchema.safeParse({
			...validCreate,
			choices: [{ label: "4", isCorrect: true }],
		});
		expect(result.success).toBe(false);
	});

	it("rejects MCQ when more than six choices are provided", () => {
		const result = createMcqSchema.safeParse({
			...validCreate,
			choices: [
				{ label: "A", isCorrect: true },
				{ label: "B", isCorrect: false },
				{ label: "C", isCorrect: false },
				{ label: "D", isCorrect: false },
				{ label: "E", isCorrect: false },
				{ label: "F", isCorrect: false },
				{ label: "G", isCorrect: false },
			],
		});
		expect(result.success).toBe(false);
	});

	it("rejects MCQ when zero or more than one choice is correct", () => {
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [
					{ label: "3", isCorrect: false },
					{ label: "4", isCorrect: false },
				],
			}).success,
		).toBe(false);
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [
					{ label: "3", isCorrect: true },
					{ label: "4", isCorrect: true },
				],
			}).success,
		).toBe(false);
	});

	it("rejects a choice with an empty label", () => {
		const result = createMcqSchema.safeParse({
			...validCreate,
			choices: [
				{ label: "   ", isCorrect: false },
				{ label: "4", isCorrect: true },
			],
		});
		expect(result.success).toBe(false);
	});

	it("accepts a valid attempt payload", () => {
		const result = attemptSchema.safeParse({
			userId: "user-1",
			choiceId: "choice-1",
		});
		expect(result.success).toBe(true);
	});

	it("rejects attempt when userId or choiceId is missing", () => {
		expect(attemptSchema.safeParse({ choiceId: "choice-1" }).success).toBe(
			false,
		);
		expect(attemptSchema.safeParse({ userId: "user-1" }).success).toBe(false);
	});
});
