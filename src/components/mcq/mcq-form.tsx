"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
	addMcqChoice,
	canAddMcqChoice,
	canRemoveMcqChoice,
	createEmptyMcqForm,
	isMcqFormSaveValid,
	mapMcqFormErrors,
	mcqFormCancelHref,
	mcqFormSaveHref,
	mcqRecordToForm,
	readCurrentUserId,
	removeMcqChoice,
	type McqFormErrorMap,
	type McqFormState,
} from "@/lib/mcq/form-ui";
import type { McqRecord } from "@/lib/services/mcq-service";
import { cn } from "@/lib/utils";

type McqFormProps = {
	mode: "create" | "edit";
	mcqId?: string;
};

export function McqForm({ mode, mcqId }: McqFormProps) {
	const router = useRouter();
	const [form, setForm] = useState<McqFormState>(createEmptyMcqForm);
	const [errors, setErrors] = useState<McqFormErrorMap>({});
	const [pending, setPending] = useState(false);
	const [loading, setLoading] = useState(mode === "edit");

	useEffect(() => {
		if (mode !== "edit" || !mcqId) {
			return;
		}

		let cancelled = false;
		async function load() {
			const response = await fetch(`/api/mcqs/${mcqId}`);
			if (!response.ok) {
				if (!cancelled) {
					setErrors({ form: "That question is no longer available." });
					setLoading(false);
				}
				return;
			}
			const record = (await response.json()) as McqRecord;
			if (!cancelled) {
				setForm(mcqRecordToForm(record));
				setLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [mode, mcqId]);

	const correctIndex = Math.max(
		0,
		form.choices.findIndex((choice) => choice.isCorrect),
	);

	function updateChoiceLabel(index: number, label: string) {
		setForm((current) => ({
			...current,
			choices: current.choices.map((choice, choiceIndex) =>
				choiceIndex === index ? { ...choice, label } : choice,
			),
		}));
	}

	function markCorrect(index: number) {
		setForm((current) => ({
			...current,
			choices: current.choices.map((choice, choiceIndex) => ({
				...choice,
				isCorrect: choiceIndex === index,
			})),
		}));
	}

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrors({});

		if (!isMcqFormSaveValid(form)) {
			const parsed = mapMcqFormErrors({
				formErrors: ["Check the name, question, and choices."],
				fieldErrors: {},
			});
			if (!form.name.trim()) {
				parsed.name = "Name is required";
			}
			if (!form.question.trim()) {
				parsed.question = "Question is required";
			}
			if (form.choices.filter((choice) => choice.isCorrect).length !== 1) {
				parsed.choices = "Exactly one choice must be correct";
			}
			if (form.choices.some((choice) => choice.label.trim() === "")) {
				parsed.choices = "Choice label is required";
			}
			setErrors(parsed);
			return;
		}

		const createdBy = readCurrentUserId();
		if (mode === "create" && !createdBy) {
			setErrors({ form: "Log in again to create a question." });
			return;
		}

		setPending(true);
		try {
			const response = await fetch(
				mode === "create" ? "/api/mcqs" : `/api/mcqs/${mcqId}`,
				{
					method: mode === "create" ? "POST" : "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(
						mode === "create"
							? {
									name: form.name,
									question: form.question,
									createdBy,
									choices: form.choices,
								}
							: {
									name: form.name,
									question: form.question,
									choices: form.choices,
								},
					),
				},
			);

			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as {
					details?: {
						formErrors?: string[];
						fieldErrors?: Record<string, string[] | undefined>;
					};
					error?: string;
				} | null;
				if (body?.details) {
					setErrors(mapMcqFormErrors(body.details));
				} else {
					setErrors({ form: body?.error ?? "Could not save the question." });
				}
				return;
			}

			router.push(mcqFormSaveHref());
		} catch {
			setErrors({ form: "Could not save the question." });
		} finally {
			setPending(false);
		}
	}

	if (loading) {
		return <p className="text-sm text-muted-foreground">Loading question…</p>;
	}

	return (
		<form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
			<FieldSet>
				<FieldGroup>
					<Field data-invalid={errors.name ? true : undefined}>
						<FieldLabel htmlFor="mcq-name">Name</FieldLabel>
						<Input
							id="mcq-name"
							value={form.name}
							onChange={(event) =>
								setForm((current) => ({ ...current, name: event.target.value }))
							}
							required
						/>
						<FieldError errors={errors.name ? [{ message: errors.name }] : []} />
					</Field>
					<Field data-invalid={errors.question ? true : undefined}>
						<FieldLabel htmlFor="mcq-question">Question</FieldLabel>
						<Textarea
							id="mcq-question"
							value={form.question}
							onChange={(event) =>
								setForm((current) => ({
									...current,
									question: event.target.value,
								}))
							}
							required
						/>
						<FieldError
							errors={errors.question ? [{ message: errors.question }] : []}
						/>
					</Field>
					<Field data-invalid={errors.choices ? true : undefined}>
						<FieldLabel>Choices</FieldLabel>
						<RadioGroup
							value={String(correctIndex)}
							onValueChange={(value) => markCorrect(Number(value))}
							className="gap-3"
						>
							{form.choices.map((choice, index) => (
								<div
									key={index}
									className="flex items-center gap-3 rounded-lg border p-3"
								>
									<Input
										aria-label={`Choice ${index + 1}`}
										value={choice.label}
										onChange={(event) =>
											updateChoiceLabel(index, event.target.value)
										}
										placeholder={`Choice ${index + 1}`}
									/>
									<label className="flex shrink-0 items-center gap-2 text-sm">
										<RadioGroupItem value={String(index)} />
										Correct
									</label>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										disabled={!canRemoveMcqChoice(form) || pending}
										onClick={() =>
											setForm((current) => removeMcqChoice(current, index))
										}
										aria-label={`Remove choice ${index + 1}`}
									>
										<X />
									</Button>
								</div>
							))}
						</RadioGroup>
						<FieldError
							errors={errors.choices ? [{ message: errors.choices }] : []}
						/>
					</Field>
				</FieldGroup>
			</FieldSet>

			{errors.form ? (
				<p className="text-sm text-destructive" role="alert">
					{errors.form}
				</p>
			) : null}

			<div className="flex flex-wrap gap-2">
				<Button type="submit" disabled={pending}>
					{pending ? "Saving…" : "Save"}
				</Button>
				<Link
					href={mcqFormCancelHref()}
					className={cn(buttonVariants({ variant: "outline" }))}
				>
					Cancel
				</Link>
				<Button
					type="button"
					variant="secondary"
					disabled={!canAddMcqChoice(form) || pending}
					onClick={() => setForm((current) => addMcqChoice(current))}
				>
					Add choice
				</Button>
			</div>
		</form>
	);
}
