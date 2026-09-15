export const PREVIEW_CORRECT_MESSAGE = "Well done, good work.";
export const PREVIEW_INCORRECT_MESSAGE = "Incorrect. Please try again.";

export type PreviewChoice = {
	id: string;
	label: string;
};

export function toPreviewChoices(
	choices: Array<{ id: string; label: string; isCorrect?: boolean }>,
): PreviewChoice[] {
	return choices.map((choice) => ({
		id: choice.id,
		label: choice.label,
	}));
}

export function isPreviewSubmitValid(choiceId: string | null): boolean {
	return Boolean(choiceId && choiceId.trim() !== "");
}

export function mapPreviewResultMessage(isCorrect: boolean): string {
	return isCorrect ? PREVIEW_CORRECT_MESSAGE : PREVIEW_INCORRECT_MESSAGE;
}

export function countAttemptsUntilCorrect(results: boolean[]): number {
	const firstCorrect = results.findIndex((isCorrect) => isCorrect);
	if (firstCorrect === -1) {
		return results.length;
	}
	return firstCorrect + 1;
}

export function buildPreviewAttemptPayload(userId: string, choiceId: string) {
	return { userId, choiceId };
}
