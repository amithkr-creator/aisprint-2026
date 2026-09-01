import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password helper", () => {
	it("hashes a password to a value different from plaintext", async () => {
		const plaintext = "InstructorPass1!";
		const hash = await hashPassword(plaintext);

		expect(hash).not.toBe(plaintext);
		expect(hash.length).toBeGreaterThan(plaintext.length);
	});

	it("verifies a correct password against its hash", async () => {
		const plaintext = "InstructorPass1!";
		const hash = await hashPassword(plaintext);

		await expect(verifyPassword(plaintext, hash)).resolves.toBe(true);
	});

	it("rejects an incorrect password against its hash", async () => {
		const hash = await hashPassword("InstructorPass1!");

		await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
	});
});
