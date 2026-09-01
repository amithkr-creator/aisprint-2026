import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/auth/schemas";

describe("auth schemas", () => {
	it("accepts a valid register payload", () => {
		const result = registerSchema.safeParse({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.edu",
			password: "SecretPass1!",
		});

		expect(result.success).toBe(true);
	});

	it("rejects register when email is invalid", () => {
		const result = registerSchema.safeParse({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "not-an-email",
			password: "SecretPass1!",
		});

		expect(result.success).toBe(false);
	});

	it("rejects register when required fields are missing", () => {
		const result = registerSchema.safeParse({
			email: "ada@school.edu",
			password: "SecretPass1!",
		});

		expect(result.success).toBe(false);
	});

	it("accepts a valid login payload", () => {
		const result = loginSchema.safeParse({
			email: "ada@school.edu",
			password: "SecretPass1!",
		});

		expect(result.success).toBe(true);
	});

	it("rejects login when password is empty", () => {
		const result = loginSchema.safeParse({
			email: "ada@school.edu",
			password: "",
		});

		expect(result.success).toBe(false);
	});
});
