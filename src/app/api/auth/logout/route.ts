import { handleLogout } from "@/lib/auth/logout";

export async function POST(): Promise<Response> {
	return handleLogout();
}
