import { mcqCreatePath, mcqEditPath } from "./navigation";

export const MCQ_LIST_COLUMNS = ["name", "question", "actions"] as const;

export const MCQ_ROW_ACTIONS = ["edit", "preview", "delete"] as const;

export const MCQ_DELETE_MISSING_MESSAGE =
	"That question is no longer available.";

export function mcqCreateHref(): string {
	return mcqCreatePath();
}

export function mcqEditHref(id: string): string {
	return mcqEditPath(id);
}

export type McqDeleteOutcome =
	| { type: "refresh" }
	| { type: "error"; message: string };

export function mapMcqDeleteResponse(status: number): McqDeleteOutcome {
	if (status === 200) {
		return { type: "refresh" };
	}

	if (status === 404) {
		return { type: "error", message: MCQ_DELETE_MISSING_MESSAGE };
	}

	return { type: "error", message: "Could not delete the question." };
}
