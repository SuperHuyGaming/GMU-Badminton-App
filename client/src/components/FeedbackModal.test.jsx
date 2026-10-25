// client/src/components/FeedbackModal.test.jsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FeedbackModal from "./FeedbackModal";
import FeedbackContext from "../context/FeedbackContext";
import { AuthContext } from "../context/AuthContext";
import apiFetch from "../utils/api";

vi.mock("../utils/api", () => ({
	default: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe("FeedbackModal Component", () => {
	const mockCloseModal = vi.fn();

	const renderModal = (options = {}) => {
		const contextValue = {
			isOpen: options.isOpen !== undefined ? options.isOpen : true,
			initialData: options.initialData || { type: "bug", severity: "high", pageUrl: "/tournaments" },
			closeFeedbackModal: mockCloseModal,
			openFeedbackModal: vi.fn(),
		};

		const authValue = {
			user: options.user !== undefined ? options.user : null,
		};

		return render(
			<AuthContext.Provider value={authValue}>
				<FeedbackContext.Provider value={contextValue}>
					<FeedbackModal />
				</FeedbackContext.Provider>
			</AuthContext.Provider>
		);
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders dialog with title, category chips, and inputs when open", () => {
		renderModal();

		expect(screen.getByText("Feedback & Issue Reporting")).toBeInTheDocument();
		expect(screen.getByText("Bug Report")).toBeInTheDocument();
		expect(screen.getByText("Feature Request")).toBeInTheDocument();
		expect(screen.getByText("General Feedback")).toBeInTheDocument();
		expect(screen.getByLabelText(/Subject \/ Title/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Detailed Description/i)).toBeInTheDocument();
		expect(screen.getByText(/Detected Location:/i)).toBeInTheDocument();
	});

	it("shows severity chips when category is bug report", () => {
		renderModal();

		expect(screen.getByText(/Severity Level/i)).toBeInTheDocument();
		expect(screen.getByText(/High/i)).toBeInTheDocument();
		expect(screen.getByText(/Critical/i)).toBeInTheDocument();
	});

	it("hides severity chips when switched to Feature Request", () => {
		renderModal();

		const featureChip = screen.getByText("Feature Request");
		fireEvent.click(featureChip);

		expect(screen.queryByText(/Severity Level/i)).not.toBeInTheDocument();
	});

	it("displays validation error when title or description is missing", async () => {
		renderModal();

		const submitBtn = screen.getByRole("button", { name: /Submit Report/i });
		fireEvent.click(submitBtn);

		expect(await screen.findByText(/Please enter a title/i)).toBeInTheDocument();
	});

	it("successfully submits bug report and calls apiFetch with correct payload", async () => {
		apiFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true, message: "Thank you for your feedback!" }),
		});

		renderModal({
			user: { id: "u123", username: "AlexBadminton", email: "alex@gmu.edu" },
		});

		const titleInput = screen.getByLabelText(/Subject \/ Title/i);
		const descInput = screen.getByLabelText(/Detailed Description/i);

		fireEvent.change(titleInput, { target: { value: "Bracket canvas glitch on zoom" } });
		fireEvent.change(descInput, { target: { value: "When zooming into the finals bracket, player names overlap." } });

		const submitBtn = screen.getByRole("button", { name: /Submit Report/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(apiFetch).toHaveBeenCalledWith(
				"/api/feedback",
				expect.objectContaining({
					method: "POST",
					body: expect.stringContaining("Bracket canvas glitch on zoom"),
				})
			);
		});

		expect(mockCloseModal).toHaveBeenCalled();
	});

	it("allows guest user to submit with optional contact info", async () => {
		apiFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true }),
		});

		renderModal({ user: null });

		const nameInput = screen.getByLabelText(/Your Name \(Optional\)/i);
		const emailInput = screen.getByLabelText(/Email \(Optional, for reply\)/i);
		const titleInput = screen.getByLabelText(/Subject \/ Title/i);
		const descInput = screen.getByLabelText(/Detailed Description/i);

		fireEvent.change(nameInput, { target: { value: "Visitor Player" } });
		fireEvent.change(emailInput, { target: { value: "visitor@example.com" } });
		fireEvent.change(titleInput, { target: { value: "RAC court hours update suggestion" } });
		fireEvent.change(descInput, { target: { value: "Can RAC court hours be listed for weekends too?" } });

		const submitBtn = screen.getByRole("button", { name: /Submit Report/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(apiFetch).toHaveBeenCalledWith(
				"/api/feedback",
				expect.objectContaining({
					body: expect.stringContaining("visitor@example.com"),
				})
			);
		});
	});
});
