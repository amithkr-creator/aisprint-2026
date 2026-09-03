import {
	createMcqSchema,
	updateMcqSchema,
	type ChoiceInput,
	type CreateMcqInput,
	type UpdateMcqInput,
} from "@/lib/mcq/schemas";
import { UserNotFoundError } from "@/lib/services/user-service";

export class McqNotFoundError extends Error {
	constructor(id: string) {
		super(`MCQ not found: ${id}`);
		this.name = "McqNotFoundError";
	}
}

export class InvalidChoicesError extends Error {
	constructor(message = "MCQ choices are invalid") {
		super(message);
		this.name = "InvalidChoicesError";
	}
}

export type McqChoice = {
	id: string;
	label: string;
	isCorrect: boolean;
	sortOrder: number;
};

export type McqListItem = {
	id: string;
	name: string;
	question: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
};

export type McqRecord = McqListItem & {
	choices: McqChoice[];
};

type McqRow = {
	id: string;
	name: string;
	question: string;
	created_by: string;
	created_at: string;
	updated_at: string;
};

type ChoiceRow = {
	id: string;
	mcq_id: string;
	label: string;
	is_correct: number;
	sort_order: number;
};

function mapMcqRow(row: McqRow): McqListItem {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function mapChoiceRow(row: ChoiceRow): McqChoice {
	return {
		id: row.id,
		label: row.label,
		isCorrect: row.is_correct === 1,
		sortOrder: row.sort_order,
	};
}

function newId(): string {
	return crypto.randomUUID().replaceAll("-", "");
}

export class McqService {
	constructor(private readonly db: D1Database) {}

	async create(input: CreateMcqInput): Promise<McqRecord> {
		const parsed = createMcqSchema.safeParse(input);
		if (!parsed.success) {
			throw new InvalidChoicesError();
		}

		const author = await this.findUserId(parsed.data.createdBy);
		if (!author) {
			throw new UserNotFoundError(parsed.data.createdBy);
		}

		const id = newId();
		const now = new Date().toISOString();
		const choices = this.buildChoices(parsed.data.choices);

		await this.db
			.prepare(
				`INSERT INTO mcqs (id, name, question, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
			)
			.bind(
				id,
				parsed.data.name,
				parsed.data.question,
				parsed.data.createdBy,
				now,
				now,
			)
			.run();

		await this.insertChoices(id, choices);

		return {
			id,
			name: parsed.data.name,
			question: parsed.data.question,
			createdBy: parsed.data.createdBy,
			createdAt: now,
			updatedAt: now,
			choices,
		};
	}

	async list(): Promise<McqListItem[]> {
		const { results } = await this.db
			.prepare(
				`SELECT id, name, question, created_by, created_at, updated_at
         FROM mcqs
         ORDER BY updated_at DESC`,
			)
			.all<McqRow>();

		return results.map(mapMcqRow);
	}

	async findById(id: string): Promise<McqRecord | null> {
		const { results } = await this.db
			.prepare(
				`SELECT id, name, question, created_by, created_at, updated_at
         FROM mcqs WHERE id = ?1`,
			)
			.bind(id)
			.all<McqRow>();

		const row = results[0];
		if (!row) {
			return null;
		}

		const choices = await this.listChoices(id);
		return {
			...mapMcqRow(row),
			choices,
		};
	}

	async update(id: string, input: UpdateMcqInput): Promise<McqRecord> {
		const parsed = updateMcqSchema.safeParse(input);
		if (!parsed.success) {
			throw new InvalidChoicesError();
		}

		const existing = await this.findById(id);
		if (!existing) {
			throw new McqNotFoundError(id);
		}

		const updatedAt = new Date().toISOString();
		const choices = this.buildChoices(parsed.data.choices);

		await this.db
			.prepare(
				`UPDATE mcqs
         SET name = ?1, question = ?2, updated_at = ?3
         WHERE id = ?4`,
			)
			.bind(parsed.data.name, parsed.data.question, updatedAt, id)
			.run();

		await this.db
			.prepare(`DELETE FROM mcq_choices WHERE mcq_id = ?1`)
			.bind(id)
			.run();

		await this.insertChoices(id, choices);

		return {
			...existing,
			name: parsed.data.name,
			question: parsed.data.question,
			updatedAt,
			choices,
		};
	}

	async delete(id: string): Promise<void> {
		const existing = await this.findById(id);
		if (!existing) {
			throw new McqNotFoundError(id);
		}

		await this.db.prepare(`DELETE FROM mcqs WHERE id = ?1`).bind(id).run();
	}

	private async findUserId(userId: string): Promise<string | null> {
		const { results } = await this.db
			.prepare(`SELECT id FROM users WHERE id = ?1`)
			.bind(userId)
			.all<{ id: string }>();

		return results[0]?.id ?? null;
	}

	private async listChoices(mcqId: string): Promise<McqChoice[]> {
		const { results } = await this.db
			.prepare(
				`SELECT id, mcq_id, label, is_correct, sort_order
         FROM mcq_choices
         WHERE mcq_id = ?1
         ORDER BY sort_order ASC`,
			)
			.bind(mcqId)
			.all<ChoiceRow>();

		return results.map(mapChoiceRow);
	}

	private buildChoices(choices: ChoiceInput[]): McqChoice[] {
		return choices.map((choice, index) => ({
			id: newId(),
			label: choice.label,
			isCorrect: choice.isCorrect,
			sortOrder: index,
		}));
	}

	private async insertChoices(mcqId: string, choices: McqChoice[]): Promise<void> {
		for (const choice of choices) {
			await this.db
				.prepare(
					`INSERT INTO mcq_choices (id, mcq_id, label, is_correct, sort_order, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
				)
				.bind(
					choice.id,
					mcqId,
					choice.label,
					choice.isCorrect ? 1 : 0,
					choice.sortOrder,
					new Date().toISOString(),
					new Date().toISOString(),
				)
				.run();
		}
	}
}
