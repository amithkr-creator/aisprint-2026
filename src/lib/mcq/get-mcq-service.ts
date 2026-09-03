import { getCloudflareContext } from "@opennextjs/cloudflare";
import { McqService } from "@/lib/services/mcq-service";

export async function createMcqService(): Promise<McqService> {
	const { env } = await getCloudflareContext({ async: true });
	return new McqService(env.DB);
}
