import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { mcqCreatePath } from "@/lib/mcq/navigation";
import { cn } from "@/lib/utils";

export default function McqListPage() {
	return (
		<div className="flex flex-1 flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">
						Multiple choice questions
					</h1>
					<p className="text-sm text-muted-foreground">
						Create and manage questions in your bank. The question table arrives
						in a later phase.
					</p>
				</div>
				<Link href={mcqCreatePath()} className={cn(buttonVariants())}>
					Create
				</Link>
			</div>
		</div>
	);
}
