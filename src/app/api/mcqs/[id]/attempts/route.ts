import { createAttemptService } from "@/lib/mcq/get-attempt-service";
import { handleCreateAttempt, handleListAttempts } from "@/lib/mcq/attempts";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(
	_request: Request,
	context: RouteContext,
): Promise<Response> {
	const { id } = await context.params;
	const attemptService = await createAttemptService();
	return handleListAttempts(id, attemptService);
}

export async function POST(
	request: Request,
	context: RouteContext,
): Promise<Response> {
	const { id } = await context.params;
	const body = await request.json().catch(() => null);
	const attemptService = await createAttemptService();
	return handleCreateAttempt(id, body, attemptService);
}
