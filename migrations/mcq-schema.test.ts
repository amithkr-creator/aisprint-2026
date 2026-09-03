import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(__dirname);

function findMcqMigrationSql(): string {
	const files = readdirSync(migrationsDir).filter(
		(name) => name.endsWith(".sql") && name.includes("create_mcq_tables"),
	);

	expect(
		files.length,
		"expected a create_mcq_tables migration .sql file",
	).toBeGreaterThan(0);

	return readFileSync(path.join(migrationsDir, files[0]!), "utf8");
}

function tableBlock(sql: string, tableName: string): string {
	const match = sql.match(
		new RegExp(
			`CREATE TABLE ${tableName}\\s*\\([\\s\\S]*?\\);`,
			"i",
		),
	);
	expect(match, `expected CREATE TABLE ${tableName}`).toBeTruthy();
	return match![0];
}

describe("mcq migration schema contract", () => {
	it("ships an mcq tables migration file", () => {
		const sql = findMcqMigrationSql();
		expect(sql.toLowerCase()).toContain("create table mcqs");
		expect(sql.toLowerCase()).toContain("create table mcq_choices");
		expect(sql.toLowerCase()).toContain("create table mcq_attempts");
	});

	it("defines mcqs with id, name, question, created_by, and timestamps", () => {
		const mcqs = tableBlock(findMcqMigrationSql(), "mcqs");
		expect(mcqs).toMatch(/id\s+TEXT\s+PRIMARY\s+KEY/i);
		expect(mcqs).toMatch(/name\s+TEXT\s+NOT\s+NULL/i);
		expect(mcqs).toMatch(/question\s+TEXT\s+NOT\s+NULL/i);
		expect(mcqs).toMatch(/created_by\s+TEXT\s+NOT\s+NULL/i);
		expect(mcqs).toMatch(/created_at\s+DATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP/i);
		expect(mcqs).toMatch(/updated_at\s+DATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP/i);
		expect(mcqs).toMatch(/FOREIGN KEY\s*\(\s*created_by\s*\)\s*REFERENCES\s+users\s*\(\s*id\s*\)/i);
	});

	it("defines mcq_choices with mcq_id foreign key and is_correct", () => {
		const choices = tableBlock(findMcqMigrationSql(), "mcq_choices");
		expect(choices).toMatch(/id\s+TEXT\s+PRIMARY\s+KEY/i);
		expect(choices).toMatch(/mcq_id\s+TEXT\s+NOT\s+NULL/i);
		expect(choices).toMatch(/label\s+TEXT\s+NOT\s+NULL/i);
		expect(choices).toMatch(/is_correct\s+INTEGER\s+NOT\s+NULL/i);
		expect(choices).toMatch(/sort_order\s+INTEGER\s+NOT\s+NULL/i);
		expect(choices).toMatch(
			/FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)/i,
		);
	});

	it("defines mcq_attempts with mcq_id, user_id, choice_id, and is_correct", () => {
		const attempts = tableBlock(findMcqMigrationSql(), "mcq_attempts");
		expect(attempts).toMatch(/id\s+TEXT\s+PRIMARY\s+KEY/i);
		expect(attempts).toMatch(/mcq_id\s+TEXT\s+NOT\s+NULL/i);
		expect(attempts).toMatch(/user_id\s+TEXT\s+NOT\s+NULL/i);
		expect(attempts).toMatch(/choice_id\s+TEXT\s+NOT\s+NULL/i);
		expect(attempts).toMatch(/is_correct\s+INTEGER\s+NOT\s+NULL/i);
		expect(attempts).toMatch(
			/FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)/i,
		);
		expect(attempts).toMatch(
			/FOREIGN KEY\s*\(\s*user_id\s*\)\s*REFERENCES\s+users\s*\(\s*id\s*\)/i,
		);
		expect(attempts).toMatch(
			/FOREIGN KEY\s*\(\s*choice_id\s*\)\s*REFERENCES\s+mcq_choices\s*\(\s*id\s*\)/i,
		);
	});

	it("cascades deletes from mcqs to choices and attempts", () => {
		const sql = findMcqMigrationSql();
		const choices = tableBlock(sql, "mcq_choices");
		const attempts = tableBlock(sql, "mcq_attempts");
		expect(choices).toMatch(
			/FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i,
		);
		expect(attempts).toMatch(
			/FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i,
		);
	});
});
