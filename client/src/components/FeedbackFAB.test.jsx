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

	it("stays visible by default and is hidden at phone widths when hideOnSmallScreens is set", () => {
		const contextValue = { isOpen: false, isMinimized: false, draft: null, openFeedbackModal: vi.fn() };
		const { rerender } = render(
			<FeedbackContext.Provider value={contextValue}>
				<FeedbackFAB />
			</FeedbackContext.Provider>
		);
		expect(window.getComputedStyle(screen.getByTestId("feedback-fab-container")).display).not.toBe("none");

		rerender(
			<FeedbackContext.Provider value={contextValue}>
				<FeedbackFAB hideOnSmallScreens />
			</FeedbackContext.Provider>
		);
		// Desktop (jsdom's default 1024px width): still shown.
		const container = screen.getByTestId("feedback-fab-container");
		expect(window.getComputedStyle(container).display).toBe("block");

		// Phone widths: the base (xs) rule hides it; only the md (>=900px) media query shows it.
		const cls = [...container.classList].find((c) => c.startsWith("css-"));
		const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n").replace(/\s+/g, "");
		expect(css).toContain(`.${cls}{display:none;`);
		expect(css).toMatch(new RegExp(`@media\\(min-width:900px\\)\\{\\.${cls}\\{display:block;`));
	});
});
