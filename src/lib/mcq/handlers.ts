import {
	createMcqSchema,
	updateMcqSchema,
	type CreateMcqInput,
	type UpdateMcqInput,
} from "@/lib/mcq/schemas";
import {
	InvalidChoicesError,
	McqNotFoundError,
	type McqListItem,
	type McqRecord,
} from "@/lib/services/mcq-service";
import { UserNotFoundError } from "@/lib/services/user-service";

export type McqHttpService = {
	list(): Promise<McqListItem[]>;
	findById(id: string): Promise<McqRecord | null>;
	create(input: CreateMcqInput): Promise<McqRecord>;
	update(id: string, input: UpdateMcqInput): Promise<McqRecord>;
	delete(id: string): Promise<void>;
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

export async function handleListMcqs(
	mcqService: Pick<McqHttpService, "list">,
): Promise<Response> {
	const items = await mcqService.list();
	return Response.json({ items });
}

export async function handleGetMcq(
	id: string,
	mcqService: Pick<McqHttpService, "findById">,
): Promise<Response> {
	const mcq = await mcqService.findById(id);
	if (!mcq) {
		return notFound(new McqNotFoundError(id));
	}
	return Response.json(mcq);
}

export async function handleCreateMcq(
	body: unknown,
	mcqService: Pick<McqHttpService, "create">,
): Promise<Response> {
	const parsed = createMcqSchema.safeParse(body);
	if (!parsed.success) {
		return validationFailed(parsed.error.flatten());
	}

	try {
		const mcq = await mcqService.create(parsed.data);
		return Response.json(mcq, { status: 201 });
	} catch (error) {
		if (error instanceof InvalidChoicesError) {
			return validationFailed();
		}
		if (error instanceof UserNotFoundError) {
			return validationFailed();
		}
		throw error;
	}
}

export async function handleUpdateMcq(
	id: string,
	body: unknown,
	mcqService: Pick<McqHttpService, "update">,
): Promise<Response> {
	const parsed = updateMcqSchema.safeParse(body);
	if (!parsed.success) {
		return validationFailed(parsed.error.flatten());
	}

	try {
		const mcq = await mcqService.update(id, parsed.data);
		return Response.json(mcq);
	} catch (error) {
		if (error instanceof InvalidChoicesError) {
			return validationFailed();
		}
		if (error instanceof McqNotFoundError) {
			return notFound(error);
		}
		throw error;
	}
}

export async function handleDeleteMcq(
	id: string,
	mcqService: Pick<McqHttpService, "delete">,
): Promise<Response> {
	try {
		await mcqService.delete(id);
		return Response.json({ ok: true });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return notFound(error);
		}
		throw error;
	}
}
