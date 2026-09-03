import { describe, expect, it } from "vitest";
import {
	MCQ_ROUTES,
	mcqCreatePath,
	mcqEditPath,
	mcqListPath,
	redirectAfterMcqCancel,
	redirectAfterMcqSave,
	shellLogoutPath,
} from "@/lib/mcq/navigation";

describe("mcq navigation helpers", () => {
	it("lists MCQs at /mcq", () => {
		expect(mcqListPath()).toBe("/mcq");
		expect(MCQ_ROUTES.list).toBe("/mcq");
	});

	it("opens create at /mcq/new", () => {
		expect(mcqCreatePath()).toBe("/mcq/new");
		expect(MCQ_ROUTES.create).toBe("/mcq/new");
	});

	it("opens edit at /mcq/:id/edit", () => {
		expect(mcqEditPath("question-1")).toBe("/mcq/question-1/edit");
	});

	it("returns to the list after save", () => {
		expect(redirectAfterMcqSave()).toBe("/mcq");
		expect(MCQ_ROUTES.afterSave).toBe("/mcq");
	});

	it("returns to the list after cancel", () => {
		expect(redirectAfterMcqCancel()).toBe("/mcq");
		expect(MCQ_ROUTES.afterCancel).toBe("/mcq");
	});

	it("keeps logout at /logout from the app shell", () => {
		expect(shellLogoutPath()).toBe("/logout");
		expect(MCQ_ROUTES.logout).toBe("/logout");
	});
});
