// client/src/components/FeedbackFAB.test.jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FeedbackFAB from "./FeedbackFAB";
import FeedbackContext from "../context/FeedbackContext";

describe("FeedbackFAB Component", () => {
	it("renders floating action button with accessible aria-label", () => {
		const mockOpenModal = vi.fn();
		const contextValue = {
			isOpen: false,
			isMinimized: false,
			draft: null,
			openFeedbackModal: mockOpenModal,
		};

		render(
			<FeedbackContext.Provider value={contextValue}>
				<FeedbackFAB />
			</FeedbackContext.Provider>
		);

		const fab = screen.getByRole("button", { name: /Submit Feedback or Report Bug/i });
		expect(fab).toBeInTheDocument();

		fireEvent.click(fab);
		expect(mockOpenModal).toHaveBeenCalledWith({ type: "bug" });
	});

	it("hides when modal is open and expanded to prevent UI clutter", () => {
		const contextValue = {
			isOpen: true,
			isMinimized: false,
			draft: null,
		};

		render(
			<FeedbackContext.Provider value={contextValue}>
				<FeedbackFAB />
			</FeedbackContext.Provider>
		);

		expect(screen.queryByRole("button", { name: /Submit Feedback or Report Bug/i })).not.toBeInTheDocument();
	});

	it("calls maximizeFeedbackModal when clicked while minimized", () => {
		const mockMaximize = vi.fn();
		const contextValue = {
			isOpen: true,
			isMinimized: true,
			draft: { title: "Draft bug" },
			maximizeFeedbackModal: mockMaximize,
		};

		render(
			<FeedbackContext.Provider value={contextValue}>
				<FeedbackFAB />
			</FeedbackContext.Provider>
		);

		const fab = screen.getByRole("button", { name: /Resume Bug Report Draft/i });
		expect(fab).toBeInTheDocument();

		fireEvent.click(fab);
		expect(mockMaximize).toHaveBeenCalledTimes(1);
	});
});
