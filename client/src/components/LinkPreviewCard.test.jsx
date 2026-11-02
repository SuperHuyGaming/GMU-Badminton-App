// client/src/components/LinkPreviewCard.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LinkPreviewCard from "./LinkPreviewCard";

describe("LinkPreviewCard Component", () => {
	const samplePreview = {
		url: "https://badminton.gmu.edu/tournaments/gmu-open-2026",
		title: "2026 GMU Badminton Open Championships",
		description: "Collegiate & open division tournament hosted at the RAC.",
		image: "https://badminton.gmu.edu/flyers/open2026.jpg",
		domain: "badminton.gmu.edu",
		siteName: "Mason Badminton Connect",
	};

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("renders title, description, domain chip, and thumbnail image", () => {
		render(<LinkPreviewCard preview={samplePreview} />);

		expect(screen.getByTestId("link-preview-card")).toBeInTheDocument();
		expect(screen.getByTestId("link-preview-title")).toHaveTextContent("2026 GMU Badminton Open Championships");
		expect(screen.getByTestId("link-preview-description")).toHaveTextContent("Collegiate & open division tournament");
		expect(screen.getByTestId("link-preview-domain")).toHaveTextContent("badminton.gmu.edu");
		expect(screen.getByTestId("link-preview-image")).toHaveAttribute("src", "https://badminton.gmu.edu/flyers/open2026.jpg");
	});

	it("renders fallback globe icon when image is absent", () => {
		const noImagePreview = {
			...samplePreview,
			image: "",
			imageUrl: "",
		};

		render(<LinkPreviewCard preview={noImagePreview} />);

		expect(screen.queryByTestId("link-preview-image")).not.toBeInTheDocument();
		expect(screen.getByTestId("link-preview-fallback-icon")).toBeInTheDocument();
	});

	it("switches to fallback icon when image encounters an error during load", () => {
		render(<LinkPreviewCard preview={samplePreview} />);

		const img = screen.getByTestId("link-preview-image");
		fireEvent.error(img);

		expect(screen.queryByTestId("link-preview-image")).not.toBeInTheDocument();
		expect(screen.getByTestId("link-preview-fallback-icon")).toBeInTheDocument();
	});

	it("opens target URL in new tab when clicked", () => {
		const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => {});

		render(<LinkPreviewCard preview={samplePreview} />);

		fireEvent.click(screen.getByTestId("link-preview-card"));

		expect(windowOpenSpy).toHaveBeenCalledTimes(1);
		expect(windowOpenSpy).toHaveBeenCalledWith(
			"https://badminton.gmu.edu/tournaments/gmu-open-2026",
			"_blank",
			"noopener,noreferrer"
		);
	});

	it("opens target URL when Enter or Space key is pressed", () => {
		const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => {});

		render(<LinkPreviewCard preview={samplePreview} />);

		const card = screen.getByTestId("link-preview-card");
		fireEvent.keyDown(card, { key: "Enter" });

		expect(windowOpenSpy).toHaveBeenCalledTimes(1);
	});

	it("renders dismiss button and triggers onDismiss without navigating", () => {
		const onDismissMock = vi.fn();
		const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => {});

		render(<LinkPreviewCard preview={samplePreview} onDismiss={onDismissMock} />);

		const dismissBtn = screen.getByRole("button", { name: /Remove link preview/i });
		expect(dismissBtn).toBeInTheDocument();

		fireEvent.click(dismissBtn);

		expect(onDismissMock).toHaveBeenCalledTimes(1);
		expect(windowOpenSpy).not.toHaveBeenCalled();
	});

	it("gracefully returns null if preview is missing or empty", () => {
		const { container } = render(<LinkPreviewCard preview={null} />);
		expect(container.firstChild).toBeNull();

		const { container: emptyContainer } = render(<LinkPreviewCard preview={{}} />);
		expect(emptyContainer.firstChild).toBeNull();
	});
});
