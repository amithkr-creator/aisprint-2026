import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	DuplicateEmailError,
	UserNotFoundError,
	UserService,
} from "./user-service";

type StatementResult = {
	results?: Array<Record<string, unknown>>;
	meta?: { changes: number };
};

function createMockDb() {
	const prepare = vi.fn();
	const db = { prepare } as unknown as D1Database;

	function mockStatement(result: StatementResult) {
		const bound = {
			run: vi.fn().mockResolvedValue({
				success: true,
				meta: result.meta ?? { changes: 1 },
			}),
			all: vi.fn().mockResolvedValue({
				results: result.results ?? [],
			}),
		};
		const statement = {
			bind: vi.fn().mockReturnValue(bound),
		};
		prepare.mockReturnValueOnce(statement);
		return { statement, bound };
	}

	return { db, prepare, mockStatement };
}

describe("UserService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("creates a user with a hashed password and returns safe fields", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({ results: [] }); // findByEmail — no existing user
		mockStatement({ meta: { changes: 1 } }); // insert

		const user = await service.create({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.edu",
			password: "SecretPass1!",
		});

		expect(user).toMatchObject({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.edu",
		});
		expect(user.id).toBeTruthy();
		expect(user).not.toHaveProperty("password");
		expect(user).not.toHaveProperty("passwordHash");
	});

	it("does not persist or return plaintext password", async () => {
		const { db, prepare, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({ results: [] });
		const insert = mockStatement({ meta: { changes: 1 } });

		await service.create({
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.edu",
			password: "SecretPass1!",
		});

		const bindArgs = insert.statement.bind.mock.calls[0] as unknown[];
		expect(bindArgs).toBeDefined();
		expect(bindArgs).not.toContain("SecretPass1!");
		const passwordHashArg = bindArgs[4];
		expect(typeof passwordHashArg).toBe("string");
		expect(passwordHashArg).not.toBe("SecretPass1!");
		expect(prepare).toHaveBeenCalled();
	});

	it("rejects create when email is already taken", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({
			results: [
				{
					id: "existing-id",
					first_name: "Ada",
					last_name: "Lovelace",
					email: "ada@school.edu",
					password_hash: "hash",
					created_at: "2026-01-01",
					updated_at: "2026-01-01",
				},
			],
		});

		await expect(
			service.create({
				firstName: "Ada",
				lastName: "Lovelace",
				email: "ada@school.edu",
				password: "SecretPass1!",
			}),
		).rejects.toBeInstanceOf(DuplicateEmailError);
	});

	it("updates first name, last name, and email for an existing user", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({
			results: [
				{
					id: "user-1",
					first_name: "Ada",
					last_name: "Lovelace",
					email: "ada@school.edu",
					password_hash: "existing-hash",
					created_at: "2026-01-01",
					updated_at: "2026-01-01",
				},
			],
		});
		mockStatement({ meta: { changes: 1 } });
		mockStatement({
			results: [
				{
					id: "user-1",
					first_name: "Augusta",
					last_name: "Byron",
					email: "augusta@school.edu",
					password_hash: "existing-hash",
					created_at: "2026-01-01",
					updated_at: "2026-01-02",
				},
			],
		});

		const updated = await service.update("user-1", {
			firstName: "Augusta",
			lastName: "Byron",
			email: "augusta@school.edu",
		});

		expect(updated).toMatchObject({
			id: "user-1",
			firstName: "Augusta",
			lastName: "Byron",
			email: "augusta@school.edu",
		});
	});

	it("re-hashes password when update includes a new password", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({
			results: [
				{
					id: "user-1",
					first_name: "Ada",
					last_name: "Lovelace",
					email: "ada@school.edu",
					password_hash: "existing-hash",
					created_at: "2026-01-01",
					updated_at: "2026-01-01",
				},
			],
		});
		const updateStmt = mockStatement({ meta: { changes: 1 } });
		mockStatement({
			results: [
				{
					id: "user-1",
					first_name: "Ada",
					last_name: "Lovelace",
					email: "ada@school.edu",
					password_hash: "new-hash-placeholder",
					created_at: "2026-01-01",
					updated_at: "2026-01-02",
				},
			],
		});

		await service.update("user-1", { password: "NewSecretPass1!" });

		const bindArgs = updateStmt.statement.bind.mock.calls[0] as unknown[];
		expect(bindArgs).not.toContain("NewSecretPass1!");
		expect(bindArgs).not.toContain("existing-hash");
		const hashArg = bindArgs.find(
			(arg) => typeof arg === "string" && arg !== "user-1" && arg.includes(":"),
		);
		expect(hashArg).toBeTruthy();
		expect(hashArg).not.toBe("NewSecretPass1!");
	});

	it("deletes an existing user by id", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({
			results: [
				{
					id: "user-1",
					first_name: "Ada",
					last_name: "Lovelace",
					email: "ada@school.edu",
					password_hash: "hash",
					created_at: "2026-01-01",
					updated_at: "2026-01-01",
				},
			],
		});
		mockStatement({ meta: { changes: 1 } });

		await expect(service.delete("user-1")).resolves.toBeUndefined();
	});

	it("fails update when user id does not exist", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({ results: [] });

		await expect(
			service.update("missing-id", { firstName: "Nope" }),
		).rejects.toBeInstanceOf(UserNotFoundError);
	});

	it("fails delete when user id does not exist", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({ results: [] });

		await expect(service.delete("missing-id")).rejects.toBeInstanceOf(
			UserNotFoundError,
		);
	});

	it("finds a user by email", async () => {
		const { db, mockStatement } = createMockDb();
		const service = new UserService(db);

		mockStatement({
			results: [
				{
					id: "user-1",
					first_name: "Ada",
					last_name: "Lovelace",
					email: "ada@school.edu",
					password_hash: "stored-hash",
					created_at: "2026-01-01",
					updated_at: "2026-01-01",
				},
			],
		});

		const found = await service.findByEmail("ada@school.edu");

		expect(found).toMatchObject({
			id: "user-1",
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@school.edu",
			passwordHash: "stored-hash",
		});
	});
});
