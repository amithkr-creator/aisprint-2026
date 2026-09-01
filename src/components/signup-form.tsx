"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	mapRegisterErrorMessage,
	redirectAfterRegister,
} from "@/lib/auth/navigation";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		const form = new FormData(event.currentTarget);
		const firstName = String(form.get("firstName") ?? "").trim();
		const lastName = String(form.get("lastName") ?? "").trim();
		const email = String(form.get("email") ?? "").trim();
		const password = String(form.get("password") ?? "");
		const confirmPassword = String(form.get("confirmPassword") ?? "");

		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}

		setPending(true);
		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ firstName, lastName, email, password }),
			});
			const body = (await response.json().catch(() => null)) as {
				error?: string;
			} | null;

			if (!response.ok) {
				setError(mapRegisterErrorMessage(response.status, body));
				return;
			}

			router.push(redirectAfterRegister());
		} catch {
			setError("Unable to create your account. Please try again.");
		} finally {
			setPending(false);
		}
	}

	return (
		<Card {...props}>
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>
					Enter your information below to create your instructor account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="firstName">First name</FieldLabel>
							<Input
								id="firstName"
								name="firstName"
								type="text"
								placeholder="Ada"
								required
								autoComplete="given-name"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="lastName">Last name</FieldLabel>
							<Input
								id="lastName"
								name="lastName"
								type="text"
								placeholder="Lovelace"
								required
								autoComplete="family-name"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="m@example.com"
								required
								autoComplete="email"
							/>
							<FieldDescription>
								We&apos;ll use this as your login username. We will not share
								your email with anyone else.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input
								id="password"
								name="password"
								type="password"
								required
								minLength={8}
								autoComplete="new-password"
							/>
							<FieldDescription>
								Must be at least 8 characters long.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
							<Input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								required
								minLength={8}
								autoComplete="new-password"
							/>
							<FieldDescription>Please confirm your password.</FieldDescription>
						</Field>
						{error ? (
							<p className="text-sm text-destructive" role="alert">
								{error}
							</p>
						) : null}
						<FieldGroup>
							<Field>
								<Button type="submit" disabled={pending}>
									{pending ? "Creating account..." : "Create Account"}
								</Button>
								<FieldDescription className="px-6 text-center">
									Already have an account?{" "}
									<Link href="/login">Sign in</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
