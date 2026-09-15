import { describe, expect, it } from "vitest";
import {
	PREVIEW_CORRECT_MESSAGE,
	PREVIEW_INCORRECT_MESSAGE,
	buildPreviewAttemptPayload,
	countAttemptsUntilCorrect,
	isPreviewSubmitValid,
	mapPreviewResultMessage,
	toPreviewChoices,
} from "./preview-ui";

describe("MCQ preview UI helpers", () => {
	it("hides correctness from preview choices before submit", () => {
		const choices = toPreviewChoices([
			{ id: "c1", label: "3", isCorrect: false, sortOrder: 0 },
			{ id: "c2", label: "4", isCorrect: true, sortOrder: 1 },
		]);

		expect(choices).toEqual([
			{ id: "c1", label: "3" },
			{ id: "c2", label: "4" },
		]);
		expect(choices[0]).not.toHaveProperty("isCorrect");
		expect(choices[1]).not.toHaveProperty("isCorrect");
	});

	it("requires a selected choice before submit is valid", () => {
		expect(isPreviewSubmitValid(null)).toBe(false);
		expect(isPreviewSubmitValid("")).toBe(false);
		expect(isPreviewSubmitValid("c2")).toBe(true);
	});

	it("maps a correct attempt to the well-done message", () => {
		expect(mapPreviewResultMessage(true)).toBe(PREVIEW_CORRECT_MESSAGE);
	});

	it("maps an incorrect attempt to the try-again message", () => {
		expect(mapPreviewResultMessage(false)).toBe(PREVIEW_INCORRECT_MESSAGE);
	});

	it("counts attempts until the first correct answer", () => {
		expect(countAttemptsUntilCorrect([false, false, true])).toBe(3);
		expect(countAttemptsUntilCorrect([true])).toBe(1);
		expect(countAttemptsUntilCorrect([false, false])).toBe(2);
	});

	it("builds an attempt payload with userId and choiceId", () => {
		expect(buildPreviewAttemptPayload("user-1", "c2")).toEqual({
			userId: "user-1",
			choiceId: "c2",
		});
	});
});
