import { attemptSchema, type AttemptInput } from "@/lib/mcq/schemas";
import { McqNotFoundError } from "@/lib/services/mcq-service";
import { UserNotFoundError } from "@/lib/services/user-service";

export class ChoiceNotFoundError extends Error {
	constructor(choiceId: string, mcqId: string) {
		super(`Choice ${choiceId} not found for MCQ ${mcqId}`);
		this.name = "ChoiceNotFoundError";
	}
}

export type AttemptRecord = {
	id: string;
	mcqId: string;
	userId: string;
	choiceId: string;
	isCorrect: boolean;
	createdAt: string;
};

type AttemptRow = {
	id: string;
	mcq_id: string;
	user_id: string;
	choice_id: string;
	is_correct: number;
	created_at: string;
};

function mapAttemptRow(row: AttemptRow): AttemptRecord {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		userId: row.user_id,
		choiceId: row.choice_id,
		isCorrect: row.is_correct === 1,
		createdAt: row.created_at,
	};
}

function newId(): string {
	return crypto.randomUUID().replaceAll("-", "");
}

export class AttemptService {
	constructor(private readonly db: D1Database) {}

	async create(mcqId: string, input: AttemptInput): Promise<AttemptRecord> {
		const parsed = attemptSchema.safeParse(input);
		if (!parsed.success) {
			throw new Error("Attempt payload is invalid");
		}

		const mcq = await this.findId("mcqs", mcqId);
		if (!mcq) {
			throw new McqNotFoundError(mcqId);
		}

		const user = await this.findId("users", parsed.data.userId);
		if (!user) {
			throw new UserNotFoundError(parsed.data.userId);
		}

		const choice = await this.findChoiceOnMcq(parsed.data.choiceId, mcqId);
		if (!choice) {
			throw new ChoiceNotFoundError(parsed.data.choiceId, mcqId);
		}

		const id = newId();
		const createdAt = new Date().toISOString();
		const isCorrect = choice.is_correct === 1;

		await this.db
			.prepare(
				`INSERT INTO mcq_attempts (id, mcq_id, user_id, choice_id, is_correct, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
			)
			.bind(id, mcqId, parsed.data.userId, parsed.data.choiceId, isCorrect ? 1 : 0, createdAt)
			.run();

		return {
			id,
			mcqId,
			userId: parsed.data.userId,
			choiceId: parsed.data.choiceId,
			isCorrect,
			createdAt,
		};
	}

	async listByMcqId(mcqId: string): Promise<AttemptRecord[]> {
		const mcq = await this.findId("mcqs", mcqId);
		if (!mcq) {
			throw new McqNotFoundError(mcqId);
		}

		const { results } = await this.db
			.prepare(
				`SELECT id, mcq_id, user_id, choice_id, is_correct, created_at
         FROM mcq_attempts
         WHERE mcq_id = ?1
         ORDER BY created_at DESC`,
			)
			.bind(mcqId)
			.all<AttemptRow>();

		return results.map(mapAttemptRow);
	}

	private async findId(
		table: "mcqs" | "users",
		id: string,
	): Promise<string | null> {
		const { results } = await this.db
			.prepare(`SELECT id FROM ${table} WHERE id = ?1`)
			.bind(id)
			.all<{ id: string }>();

		return results[0]?.id ?? null;
	}

	private async findChoiceOnMcq(
		choiceId: string,
		mcqId: string,
	): Promise<{ id: string; is_correct: number } | null> {
		const { results } = await this.db
			.prepare(
				`SELECT id, is_correct FROM mcq_choices WHERE id = ?1 AND mcq_id = ?2`,
			)
			.bind(choiceId, mcqId)
			.all<{ id: string; is_correct: number }>();

		return results[0] ?? null;
	}
}
