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
		expect(screen.getByText(/Pictures & Screenshots/i)).toBeInTheDocument();
		expect(screen.getByText("Upload Picture")).toBeInTheDocument();
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

	it("allows adding and removing picture attachments via URL", async () => {
		renderModal();

		const addUrlBtn = screen.getByText("Add via URL");
		fireEvent.click(addUrlBtn);

		const urlInput = screen.getByPlaceholderText("https://example.com/screenshot.png");
		fireEvent.change(urlInput, { target: { value: "https://example.com/bug-evidence.png" } });

		const addBtn = screen.getByRole("button", { name: "Add" });
		fireEvent.click(addBtn);

		const img = screen.getByAltText("Attachment 1");
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute("src", "https://example.com/bug-evidence.png");

		// Remove the image
		const removeBtn = screen.getByLabelText("Remove picture 1");
		fireEvent.click(removeBtn);

		expect(screen.queryByAltText("Attachment 1")).not.toBeInTheDocument();
	});

	it("successfully submits bug report with attached pictures and calls apiFetch", async () => {
		apiFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true, message: "Thank you for your feedback!" }),
		});

		renderModal({
			user: { id: "u123", username: "AlexBadminton", email: "alex@gmu.edu" },
		});

		// Attach an image via URL
		fireEvent.click(screen.getByText("Add via URL"));
		const urlInput = screen.getByPlaceholderText("https://example.com/screenshot.png");
		fireEvent.change(urlInput, { target: { value: "https://example.com/court-glitch.png" } });
		fireEvent.click(screen.getByRole("button", { name: "Add" }));

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
					body: expect.stringContaining("https://example.com/court-glitch.png"),
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
