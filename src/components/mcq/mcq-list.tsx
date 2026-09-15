"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	MCQ_LIST_COLUMNS,
	mapMcqDeleteResponse,
	mcqCreateHref,
	mcqEditHref,
} from "@/lib/mcq/list-ui";
import { toPreviewChoices, type PreviewChoice } from "@/lib/mcq/preview-ui";
import type { McqListItem, McqRecord } from "@/lib/services/mcq-service";
import { cn } from "@/lib/utils";
import { McqPreviewDialog } from "@/components/mcq/mcq-preview-dialog";

function columnLabel(column: (typeof MCQ_LIST_COLUMNS)[number]): string {
	return column.charAt(0).toUpperCase() + column.slice(1);
}

export function McqList() {
	const router = useRouter();
	const [items, setItems] = useState<McqListItem[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<{
		id: string;
		name: string;
		question: string;
		choices: PreviewChoice[];
	} | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<McqListItem | null>(null);
	const [deleting, setDeleting] = useState(false);

	const loadItems = useCallback(async () => {
		const response = await fetch("/api/mcqs");
		if (!response.ok) {
			setError("Could not load questions.");
			setItems([]);
			return;
		}
		const body = (await response.json()) as { items: McqListItem[] };
		setItems(body.items);
	}, []);

	useEffect(() => {
		void loadItems();
	}, [loadItems]);

	async function handlePreview(id: string) {
		setError(null);
		const response = await fetch(`/api/mcqs/${id}`);
		if (!response.ok) {
			setError("That question is no longer available.");
			return;
		}
		const record = (await response.json()) as McqRecord;
		setPreview({
			id: record.id,
			name: record.name,
			question: record.question,
			choices: toPreviewChoices(record.choices),
		});
	}

	async function confirmDelete() {
		if (!deleteTarget) {
			return;
		}
		setDeleting(true);
		const response = await fetch(`/api/mcqs/${deleteTarget.id}`, {
			method: "DELETE",
		});
		const outcome = mapMcqDeleteResponse(response.status);
		setDeleting(false);
		setDeleteTarget(null);
		if (outcome.type === "refresh") {
			setError(null);
			await loadItems();
			return;
		}
		setError(outcome.message);
	}

	return (
		<div className="flex flex-1 flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">
						Multiple choice questions
					</h1>
					<p className="text-sm text-muted-foreground">
						Create and manage questions in your bank.
					</p>
				</div>
				<Link href={mcqCreateHref()} className={cn(buttonVariants())}>
					Create
				</Link>
			</div>

			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}

			{items === null ? (
				<p className="text-sm text-muted-foreground">Loading questions…</p>
			) : items.length === 0 ? (
				<div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
					<p className="text-sm text-muted-foreground">
						No questions yet. Create the first item in your bank.
					</p>
					<Link
						href={mcqCreateHref()}
						className={cn(buttonVariants({ variant: "outline" }))}
					>
						Create
					</Link>
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							{MCQ_LIST_COLUMNS.map((column) => (
								<TableHead
									key={column}
									className={column === "actions" ? "w-16 text-right" : undefined}
								>
									{columnLabel(column)}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{items.map((item) => (
							<TableRow key={item.id}>
								<TableCell className="font-medium">{item.name}</TableCell>
								<TableCell className="max-w-xl whitespace-normal text-muted-foreground">
									{item.question}
								</TableCell>
								<TableCell className="text-right">
									<DropdownMenu>
										<DropdownMenuTrigger
											render={
												<Button variant="ghost" size="icon-sm" />
											}
										>
											<MoreVertical />
											<span className="sr-only">Actions</span>
										</DropdownMenuTrigger>
										<DropdownMenuContent side="top" align="end">
											<DropdownMenuItem
												onClick={() => router.push(mcqEditHref(item.id))}
											>
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => void handlePreview(item.id)}>
												Preview
											</DropdownMenuItem>
											<DropdownMenuItem
												variant="destructive"
												onClick={() => setDeleteTarget(item)}
											>
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<McqPreviewDialog
				open={preview !== null}
				mcqId={preview?.id ?? ""}
				name={preview?.name ?? ""}
				question={preview?.question ?? ""}
				choices={preview?.choices ?? []}
				onOpenChange={(open) => {
					if (!open) {
						setPreview(null);
					}
				}}
			/>

			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open && !deleting) {
						setDeleteTarget(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this question?</AlertDialogTitle>
						<AlertDialogDescription>
							{deleteTarget
								? `“${deleteTarget.name}” will be removed from the bank.`
								: "This question will be removed from the bank."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={deleting}
							onClick={() => void confirmDelete()}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
