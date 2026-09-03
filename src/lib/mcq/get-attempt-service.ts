import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AttemptService } from "@/lib/services/attempt-service";

export async function createAttemptService(): Promise<AttemptService> {
	const { env } = await getCloudflareContext({ async: true });
	return new AttemptService(env.DB);
}
