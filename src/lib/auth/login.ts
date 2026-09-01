import { verifyPassword as defaultVerifyPassword } from "@/lib/auth/password";
import type { UserRecord } from "@/lib/services/user-service";
import { loginSchema } from "./schemas";

export type LoginUserService = {
	findByEmail(email: string): Promise<UserRecord | null>;
};

export type PasswordVerifier = {
	verifyPassword(password: string, storedHash: string): Promise<boolean>;
};

export async function handleLogin(
	body: unknown,
	userService: LoginUserService,
	passwordVerifier: PasswordVerifier = {
		verifyPassword: defaultVerifyPassword,
	},
): Promise<Response> {
	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: "Validation failed", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const user = await userService.findByEmail(parsed.data.email);
	const valid =
		user !== null &&
		(await passwordVerifier.verifyPassword(
			parsed.data.password,
			user.passwordHash,
		));

	if (!valid) {
		return Response.json(
			{ error: "Invalid email or password" },
			{ status: 401 },
		);
	}

	return Response.json({
		id: user.id,
		firstName: user.firstName,
		lastName: user.lastName,
		email: user.email,
	});
}
