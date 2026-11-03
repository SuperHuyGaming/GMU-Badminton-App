import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ShareModal from "./ShareModal";
import apiFetch from "../utils/api";
import { toast } from "react-hot-toast";

vi.mock("../utils/api", () => ({
	default: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe("ShareModal Component Tests", () => {
	const mockPost = {
		_id: "post-987",
		authorId: "author-123",
		authorName: "Coach Lin",
		authorPic: "https://example.com/coach.jpg",
		title: "Tournament Strategy Session",
		content: "Discussing our game plans for the upcoming collegiate open at RAC.",
		category: "training",
		imageUrls: ["https://example.com/tactics.jpg"],
	};

	const mockUser = {
		id: "user-456",
		name: "Victor Axelsen",
		profilePic: "https://example.com/victor.jpg",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders quote preview card with post title, author, and excerpt", () => {
		render(
			<ShareModal
				open={true}
				onClose={vi.fn()}
				post={mockPost}
				currentUser={mockUser}
			/>
		);

		expect(screen.getByText("Share Post")).toBeInTheDocument();
		expect(screen.getByText("Coach Lin")).toBeInTheDocument();
		expect(screen.getByText("Tournament Strategy Session")).toBeInTheDocument();
		expect(screen.getByText(/Discussing our game plans/)).toBeInTheDocument();
		expect(screen.getByTestId("quote-preview-card")).toBeInTheDocument();
	});

	it("allows typing thoughts and shares to feed via API", async () => {
		const onClose = vi.fn();
		const onShareSuccess = vi.fn();
		apiFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ _id: "new-repost-id", title: "Repost: Tournament Strategy Session" }),
		});

		render(
			<ShareModal
				open={true}
				onClose={onClose}
				post={mockPost}
				currentUser={mockUser}
				onShareSuccess={onShareSuccess}
			/>
		);

		const thoughtsInput = screen.getByTestId("share-thoughts-input");
		fireEvent.change(thoughtsInput, { target: { value: "Great insights from coach!" } });
		expect(thoughtsInput.value).toBe("Great insights from coach!");

		const shareBtn = screen.getByTestId("share-to-feed-btn");
		fireEvent.click(shareBtn);

		await waitFor(() => {
			expect(apiFetch).toHaveBeenCalledWith(
				"/api/forum",
				expect.objectContaining({
					method: "POST",
					body: expect.stringContaining("Great insights from coach!"),
				})
			);
			expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Post shared to your feed"));
			expect(onShareSuccess).toHaveBeenCalled();
			expect(onClose).toHaveBeenCalled();
		});
	});

	it("copies direct post link to clipboard on 1-click Copy Link button", async () => {
		const writeTextMock = vi.fn().mockResolvedValue();
		Object.assign(navigator, {
			clipboard: {
				writeText: writeTextMock,
			},
		});
		const onClose = vi.fn();

		render(
			<ShareModal
				open={true}
				onClose={onClose}
				post={mockPost}
				currentUser={mockUser}
			/>
		);

		const copyBtn = screen.getByTestId("copy-link-btn");
		fireEvent.click(copyBtn);

		await waitFor(() => {
			expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("/post/post-987"));
			expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("copied to clipboard"));
			expect(onClose).toHaveBeenCalled();
		});
	});

	it("copies link on Send via Direct Message button", async () => {
		const writeTextMock = vi.fn().mockResolvedValue();
		Object.assign(navigator, {
			clipboard: {
				writeText: writeTextMock,
			},
		});
		const onClose = vi.fn();

		render(
			<ShareModal
				open={true}
				onClose={onClose}
				post={mockPost}
				currentUser={mockUser}
			/>
		);

		const sendDmBtn = screen.getByTestId("send-dm-btn");
		fireEvent.click(sendDmBtn);

		await waitFor(() => {
			expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("/post/post-987"));
			expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Direct Message"));
			expect(onClose).toHaveBeenCalled();
		});
	});

	it("closes when clicking cancel or close icon button", () => {
		const onClose = vi.fn();
		render(
			<ShareModal
				open={true}
				onClose={onClose}
				post={mockPost}
				currentUser={mockUser}
			/>
		);

		const closeIconBtn = screen.getByTestId("share-modal-close-btn");
		fireEvent.click(closeIconBtn);
		expect(onClose).toHaveBeenCalled();

		const cancelBtn = screen.getByRole("button", { name: "Cancel" });
		fireEvent.click(cancelBtn);
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("copies the canonical /post/:id link (not /community#post-...)", async () => {
		const writeTextMock = vi.fn().mockResolvedValue();
		Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
		render(<ShareModal open={true} onClose={vi.fn()} post={mockPost} currentUser={mockUser} />);

		fireEvent.click(screen.getByTestId("copy-link-btn"));

		await waitFor(() => {
			expect(writeTextMock).toHaveBeenCalledWith(`${window.location.origin}/post/post-987`);
		});
		expect(writeTextMock.mock.calls[0][0]).not.toContain("#post-");
	});

	it("shows the server's message and stays open when sharing to the feed fails", async () => {
		const onClose = vi.fn();
		apiFetch.mockRejectedValueOnce(new Error("You can't repost a private post."));
		render(<ShareModal open={true} onClose={onClose} post={mockPost} currentUser={mockUser} />);

		fireEvent.click(screen.getByTestId("share-to-feed-btn"));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith("You can't repost a private post.");
		});
		expect(onClose).not.toHaveBeenCalled();
	});
});
