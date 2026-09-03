import { describe, expect, it } from "vitest";
import {
	MCQ_LIST_COLUMNS,
	MCQ_ROW_ACTIONS,
	mapMcqDeleteResponse,
	mcqCreateHref,
	mcqEditHref,
} from "@/lib/mcq/list-ui";

describe("MCQ list UI helpers", () => {
	it("defines table columns as name, question, and actions", () => {
		expect(MCQ_LIST_COLUMNS).toEqual(["name", "question", "actions"]);
	});

	it("sends create to /mcq/new", () => {
		expect(mcqCreateHref()).toBe("/mcq/new");
	});

	it("exposes edit, preview, and delete row actions", () => {
		expect(MCQ_ROW_ACTIONS).toEqual(["edit", "preview", "delete"]);
	});

	it("sends edit to /mcq/:id/edit", () => {
		expect(mcqEditHref("question-1")).toBe("/mcq/question-1/edit");
	});

	it("maps delete success to a list refresh", () => {
		expect(mapMcqDeleteResponse(200)).toEqual({ type: "refresh" });
	});

	it("maps delete 404 to a user-visible missing-question message", () => {
		const result = mapMcqDeleteResponse(404);
		expect(result).toEqual({
			type: "error",
			message: expect.any(String),
		});
		if (result.type === "error") {
			expect(result.message.length).toBeGreaterThan(0);
		}
	});
});
