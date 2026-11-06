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
	const mockMinimizeModal = vi.fn();
	const mockMaximizeModal = vi.fn();
	const mockSaveDraft = vi.fn();
	const mockClearDraft = vi.fn();

	const renderModal = (options = {}) => {
		const contextValue = {
			isOpen: options.isOpen !== undefined ? options.isOpen : true,
			isMinimized: options.isMinimized !== undefined ? options.isMinimized : false,
			draft: options.draft !== undefined ? options.draft : null,
			initialData: options.initialData || { type: "bug", severity: "high", pageUrl: "/tournaments" },
			closeFeedbackModal: mockCloseModal,
			minimizeFeedbackModal: mockMinimizeModal,
			maximizeFeedbackModal: mockMaximizeModal,
			saveDraft: mockSaveDraft,
			clearDraft: mockClearDraft,
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
		expect(screen.getByRole("button", { name: /Capture Screen/i })).toBeInTheDocument();
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

		expect(mockClearDraft).toHaveBeenCalled();
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

	it("triggers minimizeFeedbackModal when minimize button is clicked", () => {
		renderModal();

		const minimizeBtn = screen.getByLabelText("Minimize report form");
		fireEvent.click(minimizeBtn);

		expect(mockMinimizeModal).toHaveBeenCalledTimes(1);
	});

	it("renders compact floating pill when isMinimized is true and expands on click", () => {
		renderModal({
			isMinimized: true,
			draft: {
				type: "bug",
				title: "Scores not updating on Court 4",
				description: "Court 4 queue stuck",
				images: ["https://example.com/court4.png"],
			},
		});

		// The full dialog content should not be visible
		expect(screen.queryByLabelText(/Subject \/ Title/i)).not.toBeInTheDocument();

		// The floating pill should be visible with draft title and attachment badge
		expect(screen.getByText("Scores not updating on Court 4")).toBeInTheDocument();
		expect(screen.getByText(/📷 1 pic • Click to resume/i)).toBeInTheDocument();

		// Clicking expand triggers maximizeFeedbackModal
		const expandBtn = screen.getByLabelText("Expand form");
		fireEvent.click(expandBtn);

		expect(mockMaximizeModal).toHaveBeenCalledTimes(1);
	});

	it("restores draft data when opened with existing draft", () => {
		renderModal({
			isMinimized: false,
			draft: {
				type: "feature",
				severity: "medium",
				title: "Add export to PDF for tournament brackets",
				description: "Organizers want to print paper brackets",
				images: ["https://example.com/bracket-sample.png"],
			},
		});

		expect(screen.getByDisplayValue("Add export to PDF for tournament brackets")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Organizers want to print paper brackets")).toBeInTheDocument();
		expect(screen.getByText("Draft Restored")).toBeInTheDocument();
		expect(screen.getByAltText("Attachment 1")).toHaveAttribute("src", "https://example.com/bracket-sample.png");
	});

	it("clears draft when Clear draft button is clicked", () => {
		renderModal({
			isMinimized: false,
			draft: {
				type: "bug",
				title: "Stale draft to clear",
				description: "Old draft details",
				images: [],
			},
		});

		const clearBtn = screen.getByText("Clear draft");
		fireEvent.click(clearBtn);

		expect(mockClearDraft).toHaveBeenCalledTimes(1);
		expect(screen.getByLabelText(/Subject \/ Title/i)).toHaveValue("");
		expect(screen.getByLabelText(/Detailed Description/i)).toHaveValue("");
	});

	it("pre-populates title and description when provided via initialData", () => {
		renderModal({
			initialData: {
				type: "bug",
				severity: "critical",
				pageUrl: "/court-queue",
				title: "Render Error: Court queue index out of bounds",
				description: "Error: Court queue index out of bounds\n\nStack:\nat CourtQueue.jsx:45",
			},
		});

		expect(screen.getByLabelText(/Subject \/ Title/i)).toHaveValue("Render Error: Court queue index out of bounds");
		expect(screen.getByLabelText(/Detailed Description/i)).toHaveValue(
			"Error: Court queue index out of bounds\n\nStack:\nat CourtQueue.jsx:45"
		);
	});

	it("prioritizes contextual initialData error diagnostics over stale saved draft", () => {
		renderModal({
			initialData: {
				type: "bug",
				severity: "critical",
				pageUrl: "/brackets",
				title: "Render Error: Cannot read properties of undefined",
				description: "Stack trace details here",
			},
			draft: {
				type: "feature",
				title: "Old feature draft idea",
				description: "Old feature description",
			},
		});

		expect(screen.getByLabelText(/Subject \/ Title/i)).toHaveValue("Render Error: Cannot read properties of undefined");
		expect(screen.getByLabelText(/Detailed Description/i)).toHaveValue("Stack trace details here");
		expect(screen.queryByDisplayValue("Old feature draft idea")).not.toBeInTheDocument();
	});

	it("renders 1-click Capture Screen button and handles capture via getDisplayMedia", async () => {
		const stopTrackMock = vi.fn();
		const mockStream = {
			getVideoTracks: () => [{ stop: stopTrackMock }],
			getTracks: () => [{ stop: stopTrackMock }],
		};

		const originalMediaDevices = navigator.mediaDevices;
		const mockGetDisplayMedia = vi.fn().mockResolvedValue(mockStream);
		Object.defineProperty(navigator, "mediaDevices", {
			value: { getDisplayMedia: mockGetDisplayMedia },
			configurable: true,
		});

		const originalCreateElement = document.createElement.bind(document);
		const spyCreateElement = vi.spyOn(document, "createElement").mockImplementation((tag) => {
			const el = originalCreateElement(tag);
			if (tag === "canvas") {
				el.getContext = () => ({
					drawImage: vi.fn(),
				});
				el.toDataURL = () => "data:image/png;base64,mockCaptureData";
			}
			if (tag === "video") {
				el.play = vi.fn().mockResolvedValue();
			}
			return el;
		});

		renderModal();

		const captureBtn = screen.getByRole("button", { name: /Capture Screen/i });
		expect(captureBtn).toBeInTheDocument();

		fireEvent.click(captureBtn);

		await waitFor(() => {
			expect(mockGetDisplayMedia).toHaveBeenCalledWith({
				video: { mediaSource: "screen" },
			});
			expect(stopTrackMock).toHaveBeenCalled();
			expect(screen.getByAltText("Attachment 1")).toHaveAttribute(
				"src",
				"data:image/png;base64,mockCaptureData"
			);
		});

		spyCreateElement.mockRestore();
		if (originalMediaDevices) {
			Object.defineProperty(navigator, "mediaDevices", {
				value: originalMediaDevices,
				configurable: true,
			});
		}
	});

	it("preserves user edits and attachments across draft auto-save and context updates when opened with initialData", async () => {
		const contextValue = {
			isOpen: true,
			isMinimized: false,
			draft: null,
			initialData: {
				type: "bug",
				severity: "critical",
				pageUrl: "/brackets",
				title: "Crash on court select",
				description: "Stack trace: NullPointer at line 10",
			},
			closeFeedbackModal: mockCloseModal,
			minimizeFeedbackModal: mockMinimizeModal,
			maximizeFeedbackModal: mockMaximizeModal,
			saveDraft: mockSaveDraft,
			clearDraft: mockClearDraft,
			openFeedbackModal: vi.fn(),
		};

		const { rerender } = render(
			<AuthContext.Provider value={{ user: null }}>
				<FeedbackContext.Provider value={contextValue}>
					<FeedbackModal />
				</FeedbackContext.Provider>
			</AuthContext.Provider>
		);

		const descInput = screen.getByLabelText(/Detailed Description/i);
		expect(descInput).toHaveValue("Stack trace: NullPointer at line 10");

		// User edits description
		fireEvent.change(descInput, {
			target: { value: "Stack trace: NullPointer at line 10\nUser added note: only happens on Court 3." },
		});
		expect(descInput).toHaveValue("Stack trace: NullPointer at line 10\nUser added note: only happens on Court 3.");

		// User attaches an image via URL
		fireEvent.click(screen.getByText("Add via URL"));
		const urlInput = screen.getByPlaceholderText("https://example.com/screenshot.png");
		fireEvent.change(urlInput, { target: { value: "https://example.com/court3-crash.png" } });
		fireEvent.click(screen.getByRole("button", { name: "Add" }));

		expect(screen.getByAltText("Attachment 1")).toHaveAttribute("src", "https://example.com/court3-crash.png");

		// Simulate saveDraft triggering a re-render with updated draft reference from context
		const updatedContextValue = {
			...contextValue,
			draft: {
				type: "bug",
				severity: "critical",
				title: "Crash on court select",
				description: "Stack trace: NullPointer at line 10\nUser added note: only happens on Court 3.",
				images: ["https://example.com/court3-crash.png"],
			},
		};

		rerender(
			<AuthContext.Provider value={{ user: null }}>
				<FeedbackContext.Provider value={updatedContextValue}>
					<FeedbackModal />
				</FeedbackContext.Provider>
			</AuthContext.Provider>
		);

		// Verified: user's input and attached images are strictly preserved and not wiped out by initialData
		expect(descInput).toHaveValue("Stack trace: NullPointer at line 10\nUser added note: only happens on Court 3.");
		expect(screen.getByAltText("Attachment 1")).toHaveAttribute("src", "https://example.com/court3-crash.png");
	});

	it("compresses screen capture to JPEG (0.7 quality) and scales down wide captures to max width 1280px", async () => {
		const stopTrackMock = vi.fn();
		const mockStream = {
			getVideoTracks: () => [{ stop: stopTrackMock }],
			getTracks: () => [{ stop: stopTrackMock }],
		};

		const originalMediaDevices = navigator.mediaDevices;
		const mockGetDisplayMedia = vi.fn().mockResolvedValue(mockStream);
		Object.defineProperty(navigator, "mediaDevices", {
			value: { getDisplayMedia: mockGetDisplayMedia },
			configurable: true,
		});

		let capturedCanvas = null;
		const toDataUrlSpy = vi.fn((type, quality) => `data:${type};base64,mockJpegData_q${quality}`);

		const originalCreateElement = document.createElement.bind(document);
		const spyCreateElement = vi.spyOn(document, "createElement").mockImplementation((tag) => {
			const el = originalCreateElement(tag);
			if (tag === "canvas") {
				capturedCanvas = el;
				el.getContext = () => ({
					drawImage: vi.fn(),
				});
				el.toDataURL = toDataUrlSpy;
			}
			if (tag === "video") {
				Object.defineProperty(el, "videoWidth", { value: 2560, configurable: true });
				Object.defineProperty(el, "videoHeight", { value: 1440, configurable: true });
				el.play = vi.fn().mockResolvedValue();
			}
			return el;
		});

		renderModal();

		const captureBtn = screen.getByRole("button", { name: /Capture Screen/i });
		fireEvent.click(captureBtn);

		await waitFor(() => {
			expect(toDataUrlSpy).toHaveBeenCalledWith("image/jpeg", 0.7);
			expect(capturedCanvas.width).toBe(1280);
			expect(capturedCanvas.height).toBe(720); // 1440 * (1280 / 2560) = 720
			expect(stopTrackMock).toHaveBeenCalled();
			expect(screen.getByAltText("Attachment 1")).toHaveAttribute(
				"src",
				"data:image/jpeg;base64,mockJpegData_q0.7"
			);
		});

		spyCreateElement.mockRestore();
		if (originalMediaDevices) {
			Object.defineProperty(navigator, "mediaDevices", {
				value: originalMediaDevices,
				configurable: true,
			});
		}
	});

	it("guarantees stream tracks are stopped even if screen capture video throws an error", async () => {
		const stopTrackMock = vi.fn();
		const mockStream = {
			getVideoTracks: () => [{ stop: stopTrackMock }],
			getTracks: () => [{ stop: stopTrackMock }],
		};

		const originalMediaDevices = navigator.mediaDevices;
		const mockGetDisplayMedia = vi.fn().mockResolvedValue(mockStream);
		Object.defineProperty(navigator, "mediaDevices", {
			value: { getDisplayMedia: mockGetDisplayMedia },
			configurable: true,
		});

		const originalCreateElement = document.createElement.bind(document);
		const spyCreateElement = vi.spyOn(document, "createElement").mockImplementation((tag) => {
			const el = originalCreateElement(tag);
			if (tag === "canvas") {
				el.getContext = () => ({
					drawImage: vi.fn(),
				});
				el.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockData");
			}
			if (tag === "video") {
				// Video play throws an exception
				el.play = vi.fn().mockRejectedValue(new Error("Playback failure"));
			}
			return el;
		});

		renderModal();

		const captureBtn = screen.getByRole("button", { name: /Capture Screen/i });
		fireEvent.click(captureBtn);

		await waitFor(() => {
			expect(mockGetDisplayMedia).toHaveBeenCalled();
			// Stop must be called in finally block
			expect(stopTrackMock).toHaveBeenCalled();
		});

		spyCreateElement.mockRestore();
		if (originalMediaDevices) {
			Object.defineProperty(navigator, "mediaDevices", {
				value: originalMediaDevices,
				configurable: true,
			});
		}
	});
});
