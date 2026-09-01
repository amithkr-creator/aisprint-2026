"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { redirectAfterLogout } from "@/lib/auth/navigation";

export default function LogoutPage() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function logout() {
		setPending(true);
		setError(null);
		try {
			const response = await fetch("/api/auth/logout", { method: "POST" });
			if (!response.ok) {
				setError("Unable to log out. Please try again.");
				return;
			}
			router.push(redirectAfterLogout());
		} catch {
			setError("Unable to log out. Please try again.");
		} finally {
			setPending(false);
		}
	}

	useEffect(() => {
		void logout();
		// Run once on mount for a simple logout UX.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<Card>
					<CardHeader>
						<CardTitle>Signing out</CardTitle>
						<CardDescription>
							Ending your instructor session and returning to login.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						{error ? (
							<>
								<p className="text-sm text-destructive" role="alert">
									{error}
								</p>
								<Button type="button" onClick={() => void logout()} disabled={pending}>
									{pending ? "Retrying..." : "Try again"}
								</Button>
							</>
						) : (
							<p className="text-sm text-muted-foreground">
								{pending ? "Please wait..." : "Redirecting..."}
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
