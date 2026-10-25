// client/src/components/admin/FeedbackManager.test.jsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FeedbackManager from "./FeedbackManager";
import apiFetch from "../../utils/api";

vi.mock("../../utils/api", () => ({
	default: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../../utils/socket", () => ({
	default: {
		on: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
	},
}));

describe("FeedbackManager Component", () => {
	const mockFeedback = [
		{
			_id: "fb_101",
			type: "bug",
			severity: "critical",
			title: "Authentication loop on login",
			description: "Users are redirected back to login page when clicking submit.",
			userName: "Charlie Shuttler",
			userEmail: "charlie@gmu.edu",
			pageUrl: "/auth",
			status: "pending",
			adminNotes: "",
			createdAt: new Date().toISOString(),
		},
		{
			_id: "fb_102",
			type: "feature",
			severity: "medium",
			title: "Add export to iCal feature",
			description: "Allow players to sync tournament schedules with Google Calendar.",
			userName: "Dana Smash",
			userEmail: "dana@gmu.edu",
			pageUrl: "/tournaments",
			status: "resolved",
			adminNotes: "Implemented via /api/calendar route.",
			createdAt: new Date().toISOString(),
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				feedback: mockFeedback,
				counts: {
					total: 2,
					pending: 1,
					inProgress: 0,
					resolved: 1,
					dismissed: 0,
				},
			}),
		});
	});

	it("renders title, filter chips, and submission rows from API", async () => {
		render(<FeedbackManager promptDelete={vi.fn()} />);

		expect(screen.getByText(/User Feedback & Error Reports/i)).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText("Authentication loop on login")).toBeInTheDocument();
			expect(screen.getByText("Add export to iCal feature")).toBeInTheDocument();
		});

		expect(screen.getByText("Charlie Shuttler")).toBeInTheDocument();
		expect(screen.getByText("/auth")).toBeInTheDocument();
	});

	it("filters feedback by clicking category chips", async () => {
		render(<FeedbackManager promptDelete={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByText("Authentication loop on login")).toBeInTheDocument();
		});

		const bugFilterChip = screen.getByRole("button", { name: "Bug" });
		fireEvent.click(bugFilterChip);

		await waitFor(() => {
			expect(apiFetch).toHaveBeenCalledWith(
				expect.stringContaining("type=bug")
			);
		});
	});

	it("opens detailed inspection modal when View icon is clicked", async () => {
		render(<FeedbackManager promptDelete={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByText("Authentication loop on login")).toBeInTheDocument();
		});

		const viewButtons = screen.getAllByLabelText("View report details");
		fireEvent.click(viewButtons[0]);

		expect(screen.getByText("Detailed Report")).toBeInTheDocument();
		expect(
			screen.getAllByText("Users are redirected back to login page when clicking submit.")
		).toHaveLength(2);
		expect(screen.getByPlaceholderText(/Add internal debugging notes/i)).toBeInTheDocument();
	});

	it("triggers promptDelete callback when delete icon is clicked", async () => {
		const mockPromptDelete = vi.fn();
		render(<FeedbackManager promptDelete={mockPromptDelete} />);

		await waitFor(() => {
			expect(screen.getByText("Authentication loop on login")).toBeInTheDocument();
		});

		const deleteButtons = screen.getAllByLabelText("Delete report");
		fireEvent.click(deleteButtons[0]);

		expect(mockPromptDelete).toHaveBeenCalledWith("feedback", "fb_101");
	});
});
