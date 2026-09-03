import { McqForm } from "@/components/mcq/mcq-form";

export default function CreateMcqPage() {
	return (
		<div className="flex flex-1 flex-col gap-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">
					Create multiple choice question
				</h1>
				<p className="text-sm text-muted-foreground">
					Add a name, the question, and two to six choices. Mark one as correct.
				</p>
			</div>
			<McqForm mode="create" />
		</div>
	);
}
