import { describe, expect, it } from "vitest";
import { handleLogout } from "./logout";

describe("handleLogout", () => {
	it("logout returns 200 with ok true", async () => {
		const response = await handleLogout();

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ ok: true });
		expect(response.headers.get("set-cookie")).toBeNull();
	});
});
