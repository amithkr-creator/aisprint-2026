import { describe, expect, it, vi } from "vitest";
import { DuplicateEmailError, type SafeUser } from "@/lib/services/user-service";
import { handleRegister } from "./register";

const safeUser: SafeUser = {
	id: "user-1",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@school.edu",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("handleRegister", () => {
	it("registers a user and returns 201 without password_hash", async () => {
		const create = vi.fn().mockResolvedValue(safeUser);
		const response = await handleRegister(
			{
				firstName: "Ada",
				lastName: "Lovelace",
				email: "ada@school.edu",
				password: "SecretPass1!",
			},
			{ create },
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body).toMatchObject({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.edu",
		});
		expect(body).not.toHaveProperty("password");
		expect(body).not.toHaveProperty("password_hash");
		expect(body).not.toHaveProperty("passwordHash");
		expect(create).toHaveBeenCalledWith({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.edu",
			password: "SecretPass1!",
		});
	});

	it("rejects register when email is already taken", async () => {
		const create = vi
			.fn()
			.mockRejectedValue(new DuplicateEmailError("ada@school.edu"));
		const response = await handleRegister(
			{
				firstName: "Ada",
				lastName: "Lovelace",
				email: "ada@school.edu",
				password: "SecretPass1!",
			},
			{ create },
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body).toMatchObject({ error: expect.any(String) });
	});
});
