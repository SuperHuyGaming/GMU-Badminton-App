// client/src/components/FeedbackFAB.test.jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FeedbackFAB from "./FeedbackFAB";
import FeedbackContext from "../context/FeedbackContext";

describe("FeedbackFAB Component", () => {
	it("renders floating action button with accessible aria-label", () => {
		const mockOpenModal = vi.fn();
		const contextValue = {
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
});
