import { attemptSchema, type AttemptInput } from "@/lib/mcq/schemas";
import {
	ChoiceNotFoundError,
	type AttemptRecord,
} from "@/lib/services/attempt-service";
import { McqNotFoundError } from "@/lib/services/mcq-service";
import { UserNotFoundError } from "@/lib/services/user-service";

export type AttemptHttpService = {
	create(mcqId: string, input: AttemptInput): Promise<AttemptRecord>;
	listByMcqId(mcqId: string): Promise<AttemptRecord[]>;
};

function validationFailed(details?: unknown): Response {
	return Response.json(
		details === undefined
			? { error: "Validation failed" }
			: { error: "Validation failed", details },
		{ status: 400 },
	);
}

function notFound(error: Error): Response {
	return Response.json({ error: error.message }, { status: 404 });
}

export async function handleCreateAttempt(
	mcqId: string,
	body: unknown,
	attemptService: Pick<AttemptHttpService, "create">,
): Promise<Response> {
	const parsed = attemptSchema.safeParse(body);
	if (!parsed.success) {
		return validationFailed(parsed.error.flatten());
	}

	try {
		const attempt = await attemptService.create(mcqId, parsed.data);
		return Response.json(attempt, { status: 201 });
	} catch (error) {
		if (error instanceof McqNotFoundError || error instanceof ChoiceNotFoundError) {
			return notFound(error);
		}
		if (error instanceof UserNotFoundError) {
			return validationFailed();
		}
		throw error;
	}
}

export async function handleListAttempts(
	mcqId: string,
	attemptService: Pick<AttemptHttpService, "listByMcqId">,
): Promise<Response> {
	try {
		const items = await attemptService.listByMcqId(mcqId);
		return Response.json({ items });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return notFound(error);
		}
		throw error;
	}
}
