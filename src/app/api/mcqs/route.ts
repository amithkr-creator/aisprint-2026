import { createMcqService } from "@/lib/mcq/get-mcq-service";
import { handleCreateMcq, handleListMcqs } from "@/lib/mcq/handlers";

export async function GET(): Promise<Response> {
	const mcqService = await createMcqService();
	return handleListMcqs(mcqService);
}

export async function POST(request: Request): Promise<Response> {
	const body = await request.json().catch(() => null);
	const mcqService = await createMcqService();
	return handleCreateMcq(body, mcqService);
}
