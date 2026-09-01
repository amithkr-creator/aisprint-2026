import {
	DuplicateEmailError,
	type CreateUserInput,
	type SafeUser,
} from "@/lib/services/user-service";
import { registerSchema } from "./schemas";

export type RegisterUserService = {
	create(input: CreateUserInput): Promise<SafeUser>;
};

export async function handleRegister(
	body: unknown,
	userService: RegisterUserService,
): Promise<Response> {
	const parsed = registerSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: "Validation failed", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	try {
		const user = await userService.create(parsed.data);
		return Response.json(
			{
				id: user.id,
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email,
				createdAt: user.createdAt,
			},
			{ status: 201 },
		);
	} catch (error) {
		if (error instanceof DuplicateEmailError) {
			return Response.json(
				{ error: "Email already registered" },
				{ status: 409 },
			);
		}
		throw error;
	}
}
