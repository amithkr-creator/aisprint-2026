import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function McqPlaceholderPage() {
	return (
		<main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 p-6 md:p-10">
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">
					MCQ Question Bank
				</h1>
				<p className="text-muted-foreground">
					Coming soon. Question banks will be added in a later phase. This blank
					page confirms post-login navigation works.
				</p>
			</div>
			<div>
				<Link
					href="/logout"
					className={cn(buttonVariants({ variant: "outline" }))}
				>
					Log out
				</Link>
			</div>
		</main>
	);
}
