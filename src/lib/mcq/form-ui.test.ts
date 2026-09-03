import { describe, expect, it } from "vitest";
import {
	addMcqChoice,
	canAddMcqChoice,
	canRemoveMcqChoice,
	createEmptyMcqForm,
	isMcqFormSaveValid,
	mapMcqFormErrors,
	mcqFormCancelHref,
	mcqFormSaveHref,
	removeMcqChoice,
} from "@/lib/mcq/form-ui";

describe("MCQ form UI helpers", () => {
	it("starts the form with two empty choices", () => {
		const form = createEmptyMcqForm();
		expect(form.choices).toHaveLength(2);
		expect(form.choices.every((choice) => choice.label === "")).toBe(true);
	});

	it("allows adding a choice until there are six", () => {
		let form = createEmptyMcqForm();
		while (canAddMcqChoice(form)) {
			form = addMcqChoice(form);
		}
		expect(form.choices).toHaveLength(6);
	});

	it("does not add a seventh choice", () => {
		let form = createEmptyMcqForm();
		for (let index = 0; index < 10; index += 1) {
			form = addMcqChoice(form);
		}
		expect(form.choices).toHaveLength(6);
	});

	it("allows removing a choice until two remain", () => {
		let form = addMcqChoice(createEmptyMcqForm());
		expect(canRemoveMcqChoice(form)).toBe(true);
		form = removeMcqChoice(form, 2);
		expect(form.choices).toHaveLength(2);
		expect(canRemoveMcqChoice(form)).toBe(false);
	});

	it("does not remove a choice when only two remain", () => {
		const form = createEmptyMcqForm();
		expect(removeMcqChoice(form, 0).choices).toHaveLength(2);
	});

	it("keeps exactly one correct choice after removing the correct option", () => {
		let form = addMcqChoice(createEmptyMcqForm());
		form.choices = [
			{ label: "A", isCorrect: true },
			{ label: "B", isCorrect: false },
			{ label: "C", isCorrect: false },
		];
		form = removeMcqChoice(form, 0);
		expect(form.choices).toEqual([
			{ label: "B", isCorrect: true },
			{ label: "C", isCorrect: false },
		]);
	});

	it("requires name and question before save is valid", () => {
		const form = createEmptyMcqForm();
		form.name = "";
		form.question = "";
		form.choices = [
			{ label: "3", isCorrect: false },
			{ label: "4", isCorrect: true },
		];
		expect(isMcqFormSaveValid(form)).toBe(false);

		form.name = "Addition warmup";
		form.question = "What is 2 + 2?";
		expect(isMcqFormSaveValid(form)).toBe(true);
	});

	it("requires exactly one correct choice before save is valid", () => {
		const form = createEmptyMcqForm();
		form.name = "Addition warmup";
		form.question = "What is 2 + 2?";
		form.choices = [
			{ label: "3", isCorrect: false },
			{ label: "4", isCorrect: false },
		];
		expect(isMcqFormSaveValid(form)).toBe(false);

		form.choices[1].isCorrect = true;
		expect(isMcqFormSaveValid(form)).toBe(true);
	});

	it("sends successful save back to /mcq", () => {
		expect(mcqFormSaveHref()).toBe("/mcq");
	});

	it("sends cancel back to /mcq", () => {
		expect(mcqFormCancelHref()).toBe("/mcq");
	});

	it("maps 400 validation errors to field messages", () => {
		expect(
			mapMcqFormErrors({
				formErrors: ["Exactly one choice must be correct"],
				fieldErrors: {
					name: ["Name is required"],
					question: ["Question is required"],
				},
			}),
		).toEqual({
			name: "Name is required",
			question: "Question is required",
			choices: "Exactly one choice must be correct",
		});
	});
});
