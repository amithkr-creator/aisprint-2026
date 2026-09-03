export const MCQ_ROUTES = {
	list: "/mcq",
	create: "/mcq/new",
	logout: "/logout",
	afterSave: "/mcq",
	afterCancel: "/mcq",
} as const;

export function mcqListPath(): string {
	return MCQ_ROUTES.list;
}

export function mcqCreatePath(): string {
	return MCQ_ROUTES.create;
}

export function mcqEditPath(id: string): string {
	return `/mcq/${id}/edit`;
}

export function redirectAfterMcqSave(): string {
	return MCQ_ROUTES.afterSave;
}

export function redirectAfterMcqCancel(): string {
	return MCQ_ROUTES.afterCancel;
}

export function shellLogoutPath(): string {
	return MCQ_ROUTES.logout;
}
