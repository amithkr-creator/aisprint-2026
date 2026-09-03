import { createMcqService } from "@/lib/mcq/get-mcq-service";
import {
	handleDeleteMcq,
	handleGetMcq,
	handleUpdateMcq,
} from "@/lib/mcq/handlers";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(
	_request: Request,
	context: RouteContext,
): Promise<Response> {
	const { id } = await context.params;
	const mcqService = await createMcqService();
	return handleGetMcq(id, mcqService);
}

export async function PUT(
	request: Request,
	context: RouteContext,
): Promise<Response> {
	const { id } = await context.params;
	const body = await request.json().catch(() => null);
	const mcqService = await createMcqService();
	return handleUpdateMcq(id, body, mcqService);
}

export async function DELETE(
	_request: Request,
	context: RouteContext,
): Promise<Response> {
	const { id } = await context.params;
	const mcqService = await createMcqService();
	return handleDeleteMcq(id, mcqService);
}
