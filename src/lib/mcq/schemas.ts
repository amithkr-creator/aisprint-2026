import { z } from "zod";

export const choiceInputSchema = z.object({
	label: z.string().trim().min(1, "Choice label is required"),
	isCorrect: z.boolean(),
});

const choicesSchema = z
	.array(choiceInputSchema)
	.min(2, "At least two choices are required")
	.max(6, "No more than six choices are allowed")
	.refine(
		(choices) => choices.filter((choice) => choice.isCorrect).length === 1,
		{ message: "Exactly one choice must be correct" },
	);

export const createMcqSchema = z.object({
	name: z.string().trim().min(1, "Name is required"),
	question: z.string().trim().min(1, "Question is required"),
	createdBy: z.string().trim().min(1, "createdBy is required"),
	choices: choicesSchema,
});

export const updateMcqSchema = z.object({
	name: z.string().trim().min(1, "Name is required"),
	question: z.string().trim().min(1, "Question is required"),
	choices: choicesSchema,
});

export const attemptSchema = z.object({
	userId: z.string().trim().min(1, "userId is required"),
	choiceId: z.string().trim().min(1, "choiceId is required"),
});

export type ChoiceInput = z.infer<typeof choiceInputSchema>;
export type CreateMcqInput = z.infer<typeof createMcqSchema>;
export type UpdateMcqInput = z.infer<typeof updateMcqSchema>;
export type AttemptInput = z.infer<typeof attemptSchema>;
