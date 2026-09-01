import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		environment: "node",
		include: ["**/*.test.ts"],
		exclude: ["node_modules", ".next", ".open-next"],
	},
	resolve: {
		alias: {
			"@": path.resolve(rootDir, "./src"),
		},
	},
});
