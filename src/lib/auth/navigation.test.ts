import { describe, expect, it } from "vitest";
import {
	AUTH_ROUTES,
	mapLoginErrorMessage,
	mapRegisterErrorMessage,
	redirectAfterLogin,
	redirectAfterLogout,
	redirectAfterRegister,
} from "@/lib/auth/navigation";

describe("auth navigation helpers", () => {
	it("sends successful login to /mcq", () => {
		expect(redirectAfterLogin()).toBe("/mcq");
		expect(AUTH_ROUTES.afterLogin).toBe("/mcq");
	});

	it("sends successful logout to /login", () => {
		expect(redirectAfterLogout()).toBe("/login");
		expect(AUTH_ROUTES.afterLogout).toBe("/login");
	});

	it("sends successful register to /login", () => {
		expect(redirectAfterRegister()).toBe("/login");
		expect(AUTH_ROUTES.afterRegister).toBe("/login");
	});

	it("uses /login as the app entry route from home", () => {
		expect(AUTH_ROUTES.home).toBe("/");
		expect(AUTH_ROUTES.login).toBe("/login");
	});

	it("maps duplicate-email register failure to a user-visible message", () => {
		expect(mapRegisterErrorMessage(409, { error: "Email already registered" })).toBe(
			"An account with this email already exists.",
		);
	});

	it("maps invalid login to a generic credentials message", () => {
		expect(
			mapLoginErrorMessage(401, { error: "Invalid email or password" }),
		).toBe("Invalid email or password.");
	});
});
