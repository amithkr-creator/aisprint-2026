import { hashPassword } from "@/lib/auth/password";

export class DuplicateEmailError extends Error {
	constructor(email: string) {
		super(`Email already registered: ${email}`);
		this.name = "DuplicateEmailError";
	}
}

export class UserNotFoundError extends Error {
	constructor(id: string) {
		super(`User not found: ${id}`);
		this.name = "UserNotFoundError";
	}
}

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
};

export type UpdateUserInput = {
	firstName?: string;
	lastName?: string;
	email?: string;
	password?: string;
};

export type SafeUser = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	createdAt: string;
	updatedAt: string;
};

export type UserRecord = SafeUser & {
	passwordHash: string;
};

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
};

function mapRow(row: UserRow): UserRecord {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		email: row.email,
		passwordHash: row.password_hash,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toSafeUser(user: UserRecord): SafeUser {
	return {
		id: user.id,
		firstName: user.firstName,
		lastName: user.lastName,
		email: user.email,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
}

function newUserId(): string {
	return crypto.randomUUID().replaceAll("-", "");
}

export class UserService {
	constructor(private readonly db: D1Database) {}

	async create(input: CreateUserInput): Promise<SafeUser> {
		const existing = await this.findByEmail(input.email);
		if (existing) {
			throw new DuplicateEmailError(input.email);
		}

		const id = newUserId();
		const passwordHash = await hashPassword(input.password);
		const now = new Date().toISOString();

		await this.db
			.prepare(
				`INSERT INTO users (id, first_name, last_name, email, password_hash, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
			)
			.bind(
				id,
				input.firstName,
				input.lastName,
				input.email,
				passwordHash,
				now,
				now,
			)
			.run();

		return {
			id,
			firstName: input.firstName,
			lastName: input.lastName,
			email: input.email,
			createdAt: now,
			updatedAt: now,
		};
	}

	async update(id: string, input: UpdateUserInput): Promise<SafeUser> {
		const existing = await this.findById(id);
		if (!existing) {
			throw new UserNotFoundError(id);
		}

		const firstName = input.firstName ?? existing.firstName;
		const lastName = input.lastName ?? existing.lastName;
		const email = input.email ?? existing.email;
		const passwordHash = input.password
			? await hashPassword(input.password)
			: existing.passwordHash;
		const updatedAt = new Date().toISOString();

		await this.db
			.prepare(
				`UPDATE users
         SET first_name = ?1, last_name = ?2, email = ?3, password_hash = ?4, updated_at = ?5
         WHERE id = ?6`,
			)
			.bind(firstName, lastName, email, passwordHash, updatedAt, id)
			.run();

		const updated = await this.findById(id);
		if (!updated) {
			throw new UserNotFoundError(id);
		}

		return toSafeUser(updated);
	}

	async delete(id: string): Promise<void> {
		const existing = await this.findById(id);
		if (!existing) {
			throw new UserNotFoundError(id);
		}

		await this.db.prepare(`DELETE FROM users WHERE id = ?1`).bind(id).run();
	}

	async findByEmail(email: string): Promise<UserRecord | null> {
		const { results } = await this.db
			.prepare(
				`SELECT id, first_name, last_name, email, password_hash, created_at, updated_at
         FROM users WHERE email = ?1`,
			)
			.bind(email)
			.all<UserRow>();

		const row = results[0];
		return row ? mapRow(row) : null;
	}

	async findById(id: string): Promise<UserRecord | null> {
		const { results } = await this.db
			.prepare(
				`SELECT id, first_name, last_name, email, password_hash, created_at, updated_at
         FROM users WHERE id = ?1`,
			)
			.bind(id)
			.all<UserRow>();

		const row = results[0];
		return row ? mapRow(row) : null;
	}
}
