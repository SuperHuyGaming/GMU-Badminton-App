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

	it("unmounts when modal is open and minimized to prevent double-mounting with minimized pill", () => {
		const contextValue = {
			isOpen: true,
			isMinimized: true,
			draft: { title: "Draft bug" },
		};

		render(
			<FeedbackContext.Provider value={contextValue}>
				<FeedbackFAB />
			</FeedbackContext.Provider>
		);

		expect(screen.queryByTestId("feedback-fab-container")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Resume Bug Report Draft/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Submit Feedback or Report Bug/i })).not.toBeInTheDocument();
	});

	it("renders resume draft tooltip and badge when draft exists while modal is closed", () => {
		const mockOpenModal = vi.fn();
		const contextValue = {
			isOpen: false,
			isMinimized: false,
			draft: { title: "Draft bug" },
			openFeedbackModal: mockOpenModal,
		};

		render(
			<FeedbackContext.Provider value={contextValue}>
				<FeedbackFAB />
			</FeedbackContext.Provider>
		);

		const fab = screen.getByRole("button", { name: /Resume Bug Report Draft/i });
		expect(fab).toBeInTheDocument();

		fireEvent.click(fab);
		expect(mockOpenModal).toHaveBeenCalledWith({ type: "bug" });
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

	it("anchors the FAB in the bottom-right corner horizontally adjacent to Messenger launcher", () => {
		const contextValue = { isOpen: false, isMinimized: false, draft: null, openFeedbackModal: vi.fn() };
		render(
			<FeedbackContext.Provider value={contextValue}>
				<FeedbackFAB />
			</FeedbackContext.Provider>
		);
		const container = screen.getByTestId("feedback-fab-container");
		const cls = [...container.classList].find((c) => c.startsWith("css-"));
		const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("\n").replace(/\s+/g, "");
		expect(css).toContain(`position:fixed;`);
		expect(css).toMatch(new RegExp(`\\.${cls}\\{[^}]*right:76px`));
		expect(css).toMatch(new RegExp(`\\.${cls}\\{[^}]*bottom:20px`));
		expect(css).toMatch(new RegExp(`@media\\(min-width:600px\\)\\{\\.${cls}\\{[^}]*bottom:24px;`));
		expect(css).toMatch(new RegExp(`@media\\(min-width:600px\\)\\{\\.${cls}\\{[^}]*right:84px;`));
		expect(css).not.toContain(`left:16px`);
		expect(css).not.toContain(`left:28px`);
	});
});
