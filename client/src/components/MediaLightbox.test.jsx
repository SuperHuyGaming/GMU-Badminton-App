import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MediaLightbox from "./MediaLightbox";

describe("MediaLightbox Component Tests", () => {
	const mockImages = [
		"https://example.com/badminton-1.jpg",
		"https://example.com/badminton-2.jpg",
		"https://example.com/badminton-3.jpg",
	];

	it("renders nothing when images array is empty", () => {
		const { container } = render(
			<MediaLightbox open={true} onClose={vi.fn()} images={[]} />
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders author name, title, counter chip, and main image when open", () => {
		render(
			<MediaLightbox
				open={true}
				onClose={vi.fn()}
				images={mockImages}
				initialIndex={0}
				title="Championship Final Smash"
				authorName="Sarah Jenkins"
			/>
		);

		expect(screen.getByText("Sarah Jenkins")).toBeInTheDocument();
		expect(screen.getByText("Championship Final Smash")).toBeInTheDocument();
		expect(screen.getByText("1 / 3")).toBeInTheDocument();
		const mainImg = screen.getByAltText("Media attachment 1");
		expect(mainImg).toBeInTheDocument();
		expect(mainImg).toHaveAttribute("src", mockImages[0]);
	});

	it("navigates to next and previous images using action buttons", () => {
		render(
			<MediaLightbox
				open={true}
				onClose={vi.fn()}
				images={mockImages}
				initialIndex={0}
			/>
		);

		const nextBtn = screen.getByRole("button", { name: /Next image/i });
		fireEvent.click(nextBtn);
		expect(screen.getByText("2 / 3")).toBeInTheDocument();
		expect(screen.getByAltText("Media attachment 2")).toHaveAttribute("src", mockImages[1]);

		const prevBtn = screen.getByRole("button", { name: /Previous image/i });
		fireEvent.click(prevBtn);
		expect(screen.getByText("1 / 3")).toBeInTheDocument();
		expect(screen.getByAltText("Media attachment 1")).toHaveAttribute("src", mockImages[0]);
	});

	it("wraps around when clicking prev from index 0", () => {
		render(
			<MediaLightbox
				open={true}
				onClose={vi.fn()}
				images={mockImages}
				initialIndex={0}
			/>
		);

		const prevBtn = screen.getByRole("button", { name: /Previous image/i });
		fireEvent.click(prevBtn);
		expect(screen.getByText("3 / 3")).toBeInTheDocument();
		expect(screen.getByAltText("Media attachment 3")).toHaveAttribute("src", mockImages[2]);
	});

	it("handles keyboard navigation: ArrowRight, ArrowLeft, and Escape", () => {
		const onClose = vi.fn();
		render(
			<MediaLightbox
				open={true}
				onClose={onClose}
				images={mockImages}
				initialIndex={0}
			/>
		);

		// ArrowRight -> next image
		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect(screen.getByText("2 / 3")).toBeInTheDocument();

		// ArrowLeft -> prev image
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		expect(screen.getByText("1 / 3")).toBeInTheDocument();

		// Escape -> close dialog
		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalled();
	});

	it("supports mobile touch swipe navigation with 50px delta threshold", () => {
		render(
			<MediaLightbox
				open={true}
				onClose={vi.fn()}
				images={mockImages}
				initialIndex={0}
			/>
		);

		const container = screen.getByTestId("lightbox-main-container");

		// Swipe left: diff = 100 - 200 = -100px (< -50px) -> triggers Next
		fireEvent.touchStart(container, {
			touches: [{ clientX: 200, clientY: 100 }],
		});
		fireEvent.touchEnd(container, {
			changedTouches: [{ clientX: 100, clientY: 100 }],
		});
		expect(screen.getByText("2 / 3")).toBeInTheDocument();

		// Swipe right: diff = 220 - 120 = +100px (> 50px) -> triggers Prev
		fireEvent.touchStart(container, {
			touches: [{ clientX: 120, clientY: 100 }],
		});
		fireEvent.touchEnd(container, {
			changedTouches: [{ clientX: 220, clientY: 100 }],
		});
		expect(screen.getByText("1 / 3")).toBeInTheDocument();

		// Small swipe (< 50px) does not navigate
		fireEvent.touchStart(container, {
			touches: [{ clientX: 150, clientY: 100 }],
		});
		fireEvent.touchEnd(container, {
			changedTouches: [{ clientX: 135, clientY: 100 }],
		});
		expect(screen.getByText("1 / 3")).toBeInTheDocument();
	});

	it("switches images when clicking thumbnails in the bottom strip", () => {
		render(
			<MediaLightbox
				open={true}
				onClose={vi.fn()}
				images={mockImages}
				initialIndex={0}
			/>
		);

		const thirdThumb = screen.getByRole("button", { name: /Jump to photo 3/i });
		fireEvent.click(thirdThumb);
		expect(screen.getByText("3 / 3")).toBeInTheDocument();
		expect(screen.getByAltText("Media attachment 3")).toHaveAttribute("src", mockImages[2]);
	});

	it("renders accessible ARIA labels on all control buttons", () => {
		render(
			<MediaLightbox
				open={true}
				onClose={vi.fn()}
				images={mockImages}
				initialIndex={0}
			/>
		);

		expect(screen.getByRole("button", { name: "Close fullscreen gallery" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Download image" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Previous image" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Next image" })).toBeInTheDocument();
	});
});
