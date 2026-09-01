import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(__dirname);

function findUsersMigrationSql(): string {
	const files = readdirSync(migrationsDir).filter(
		(name) => name.endsWith(".sql") && name.includes("create_users"),
	);

	expect(files.length, "expected a create_users migration .sql file").toBeGreaterThan(0);

	return readFileSync(path.join(migrationsDir, files[0]!), "utf8");
}

describe("users migration schema contract", () => {
	it("ships a users migration file", () => {
		const sql = findUsersMigrationSql();
		expect(sql.toLowerCase()).toContain("create table users");
	});

	it("defines users.id as TEXT PRIMARY KEY", () => {
		const sql = findUsersMigrationSql();
		expect(sql).toMatch(/id\s+TEXT\s+PRIMARY\s+KEY/i);
	});

	it("requires first_name, last_name, email, and password_hash", () => {
		const sql = findUsersMigrationSql();
		expect(sql).toMatch(/first_name\s+TEXT\s+NOT\s+NULL/i);
		expect(sql).toMatch(/last_name\s+TEXT\s+NOT\s+NULL/i);
		expect(sql).toMatch(/email\s+TEXT\s+NOT\s+NULL/i);
		expect(sql).toMatch(/password_hash\s+TEXT\s+NOT\s+NULL/i);
	});

	it("enforces UNIQUE on email", () => {
		const sql = findUsersMigrationSql();
		const hasInlineUnique = /email\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(sql);
		const hasTableUnique = /UNIQUE\s*\(\s*email\s*\)/i.test(sql);
		expect(hasInlineUnique || hasTableUnique).toBe(true);
	});

	it("includes created_at and updated_at defaults", () => {
		const sql = findUsersMigrationSql();
		expect(sql).toMatch(/created_at\s+DATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP/i);
		expect(sql).toMatch(/updated_at\s+DATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP/i);
	});
});
