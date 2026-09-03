import { McqForm } from "@/components/mcq/mcq-form";

type EditMcqPageProps = {
	params: Promise<{ id: string }>;
};

export default async function EditMcqPage({ params }: EditMcqPageProps) {
	const { id } = await params;

	return (
		<div className="flex flex-1 flex-col gap-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">
					Edit multiple choice question
				</h1>
				<p className="text-sm text-muted-foreground">
					Update the name, question, and choices. Exactly one choice must stay
					correct.
				</p>
			</div>
			<McqForm mode="edit" mcqId={id} />
		</div>
	);
}
