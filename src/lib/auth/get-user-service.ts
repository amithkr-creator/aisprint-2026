import { getCloudflareContext } from "@opennextjs/cloudflare";
import { UserService } from "@/lib/services/user-service";

export async function createUserService(): Promise<UserService> {
	const { env } = await getCloudflareContext({ async: true });
	return new UserService(env.DB);
}
