export const AUTH_ROUTES = {
	home: "/",
	register: "/register",
	login: "/login",
	logout: "/logout",
	mcq: "/mcq",
	afterRegister: "/login",
	afterLogin: "/mcq",
	afterLogout: "/login",
} as const;

export function redirectAfterRegister(): string {
	return AUTH_ROUTES.afterRegister;
}

export function redirectAfterLogin(): string {
	return AUTH_ROUTES.afterLogin;
}

export function redirectAfterLogout(): string {
	return AUTH_ROUTES.afterLogout;
}

export function mapRegisterErrorMessage(
	status: number,
	body: { error?: string } | null,
): string {
	if (status === 409) {
		return "An account with this email already exists.";
	}
	if (status === 400) {
		return body?.error ?? "Please check your details and try again.";
	}
	return body?.error ?? "Unable to create your account. Please try again.";
}

export function mapLoginErrorMessage(
	status: number,
	body: { error?: string } | null,
): string {
	if (status === 401) {
		return "Invalid email or password.";
	}
	if (status === 400) {
		return body?.error ?? "Please check your details and try again.";
	}
	return body?.error ?? "Unable to log in. Please try again.";
}
