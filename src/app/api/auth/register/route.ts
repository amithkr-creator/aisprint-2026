import { handleRegister } from "@/lib/auth/register";
import { createUserService } from "@/lib/auth/get-user-service";

export async function POST(request: Request): Promise<Response> {
	const body = await request.json().catch(() => null);
	const userService = await createUserService();
	return handleRegister(body, userService);
}
