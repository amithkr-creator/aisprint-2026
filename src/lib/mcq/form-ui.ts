import { updateMcqSchema } from "@/lib/mcq/schemas";
import {
	redirectAfterMcqCancel,
	redirectAfterMcqSave,
} from "@/lib/mcq/navigation";

export const MCQ_MIN_CHOICES = 2;
export const MCQ_MAX_CHOICES = 6;

export const CURRENT_USER_ID_STORAGE_KEY = "quizmaker.currentUserId";

export type McqFormChoice = {
	label: string;
	isCorrect: boolean;
};

export type McqFormState = {
	name: string;
	question: string;
	choices: McqFormChoice[];
};

export type McqFormErrorMap = {
	name?: string;
	question?: string;
	choices?: string;
	form?: string;
};

export function createEmptyMcqForm(): McqFormState {
	return {
		name: "",
		question: "",
		choices: [
			{ label: "", isCorrect: true },
			{ label: "", isCorrect: false },
		],
	};
}

export function canAddMcqChoice(form: McqFormState): boolean {
	return form.choices.length < MCQ_MAX_CHOICES;
}

export function addMcqChoice(form: McqFormState): McqFormState {
	if (!canAddMcqChoice(form)) {
		return form;
	}

	return {
		...form,
		choices: [...form.choices, { label: "", isCorrect: false }],
	};
}

export function canRemoveMcqChoice(form: McqFormState): boolean {
	return form.choices.length > MCQ_MIN_CHOICES;
}

export function removeMcqChoice(form: McqFormState, index: number): McqFormState {
	if (!canRemoveMcqChoice(form)) {
		return form;
	}

	const choices = form.choices.filter((_, choiceIndex) => choiceIndex !== index);
	if (!choices.some((choice) => choice.isCorrect) && choices[0]) {
		choices[0] = { ...choices[0], isCorrect: true };
	}

	return { ...form, choices };
}

export function isMcqFormSaveValid(form: McqFormState): boolean {
	return updateMcqSchema.safeParse(form).success;
}

export function mcqFormSaveHref(): string {
	return redirectAfterMcqSave();
}

export function mcqFormCancelHref(): string {
	return redirectAfterMcqCancel();
}

export function persistCurrentUserId(id: string): void {
	sessionStorage.setItem(CURRENT_USER_ID_STORAGE_KEY, id);
}

export function readCurrentUserId(): string | null {
	if (typeof sessionStorage === "undefined") {
		return null;
	}
	const value = sessionStorage.getItem(CURRENT_USER_ID_STORAGE_KEY);
	return value && value.trim() !== "" ? value : null;
}

export function mcqRecordToForm(record: {
	name: string;
	question: string;
	choices: McqFormChoice[];
}): McqFormState {
	return {
		name: record.name,
		question: record.question,
		choices: record.choices.map((choice) => ({
			label: choice.label,
			isCorrect: choice.isCorrect,
		})),
	};
}

export function mapMcqFormErrors(details: {
	formErrors?: string[];
	fieldErrors?: Record<string, string[] | undefined>;
}): McqFormErrorMap {
	const messages: McqFormErrorMap = {};

	for (const [field, errors] of Object.entries(details.fieldErrors ?? {})) {
		const message = errors?.[0];
		if (!message) {
			continue;
		}
		if (field === "name" || field === "question" || field === "choices") {
			messages[field] = message;
		}
	}

	const formError = details.formErrors?.[0];
	if (formError && !messages.choices) {
		messages.choices = formError;
	}

	return messages;
}
