import { describe, expect, it, vi } from "vitest";
import type { UserRecord } from "@/lib/services/user-service";
import { handleLogin } from "./login";

const userRecord: UserRecord = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.edu",
	passwordHash: "salt:hash",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("handleLogin", () => {
	it("logs in with valid email and password and returns safe fields", async () => {
		const findByEmail = vi.fn().mockResolvedValue(userRecord);
		const verify = vi.fn().mockResolvedValue(true);

		const response = await handleLogin(
			{ email: "ada@school.edu", password: "SecretPass1!" },
			{ findByEmail },
			{ verifyPassword: verify },
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.edu",
		});
		expect(body).not.toHaveProperty("passwordHash");
		expect(body).not.toHaveProperty("password_hash");
	});

	it("returns 401 with generic message when credentials are invalid", async () => {
		const findByEmail = vi.fn().mockResolvedValue(userRecord);
		const verify = vi.fn().mockResolvedValue(false);

		const response = await handleLogin(
			{ email: "ada@school.edu", password: "wrong" },
			{ findByEmail },
			{ verifyPassword: verify },
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: "Invalid email or password" });
	});

	it("does not set cookies or return tokens on login", async () => {
		const findByEmail = vi.fn().mockResolvedValue(userRecord);
		const verify = vi.fn().mockResolvedValue(true);

		const response = await handleLogin(
			{ email: "ada@school.edu", password: "SecretPass1!" },
			{ findByEmail },
			{ verifyPassword: verify },
		);

		expect(response.headers.get("set-cookie")).toBeNull();
		const body = await response.json();
		expect(body).not.toHaveProperty("token");
		expect(body).not.toHaveProperty("accessToken");
		expect(body).not.toHaveProperty("jwt");
		expect(body).not.toHaveProperty("sessionId");
	});
});
