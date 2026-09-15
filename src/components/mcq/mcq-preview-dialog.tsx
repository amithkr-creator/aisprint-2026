"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { readCurrentUserId } from "@/lib/mcq/form-ui";
import {
	buildPreviewAttemptPayload,
	countAttemptsUntilCorrect,
	isPreviewSubmitValid,
	mapPreviewResultMessage,
	type PreviewChoice,
} from "@/lib/mcq/preview-ui";

type McqPreviewDialogProps = {
	open: boolean;
	name: string;
	question: string;
	mcqId: string;
	choices: PreviewChoice[];
	onOpenChange: (open: boolean) => void;
};

export function McqPreviewDialog({
	open,
	name,
	question,
	mcqId,
	choices,
	onOpenChange,
}: McqPreviewDialogProps) {
	const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
	const [results, setResults] = useState<boolean[]>([]);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const solved = results.some((isCorrect) => isCorrect);
	const attemptCount = countAttemptsUntilCorrect(results);

	function resetState() {
		setSelectedChoiceId(null);
		setResults([]);
		setMessage(null);
		setError(null);
		setPending(false);
	}

	async function handleSubmit() {
		setError(null);
		if (!isPreviewSubmitValid(selectedChoiceId) || !selectedChoiceId) {
			setError("Select a choice before submitting.");
			return;
		}

		const userId = readCurrentUserId();
		if (!userId) {
			setError("Log in again to record this attempt.");
			return;
		}

		setPending(true);
		try {
			const response = await fetch(`/api/mcqs/${mcqId}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					buildPreviewAttemptPayload(userId, selectedChoiceId),
				),
			});
			const body = (await response.json().catch(() => null)) as {
				isCorrect?: boolean;
				error?: string;
			} | null;

			if (!response.ok || typeof body?.isCorrect !== "boolean") {
				setError(body?.error ?? "Could not record the attempt.");
				return;
			}

			const nextResults = [...results, body.isCorrect];
			setResults(nextResults);
			setMessage(mapPreviewResultMessage(body.isCorrect));
		} catch {
			setError("Could not record the attempt.");
		} finally {
			setPending(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					resetState();
				}
				onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{name}</DialogTitle>
					<DialogDescription>{question}</DialogDescription>
				</DialogHeader>

				<RadioGroup
					value={selectedChoiceId ?? ""}
					onValueChange={setSelectedChoiceId}
					className="gap-3"
					disabled={solved}
				>
					{choices.map((choice) => (
						<label
							key={choice.id}
							className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
						>
							<RadioGroupItem value={choice.id} disabled={solved} />
							<span>{choice.label}</span>
						</label>
					))}
				</RadioGroup>

				<p className="text-sm text-muted-foreground">
					Attempts: {attemptCount}
				</p>

				{message ? (
					<p
						className={
							solved
								? "text-sm font-medium text-foreground"
								: "text-sm font-medium text-destructive"
						}
						role="status"
					>
						{message}
					</p>
				) : null}

				{error ? (
					<p className="text-sm text-destructive" role="alert">
						{error}
					</p>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						disabled={pending || solved || !isPreviewSubmitValid(selectedChoiceId)}
						onClick={() => void handleSubmit()}
					>
						{pending ? "Submitting…" : "Submit"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
