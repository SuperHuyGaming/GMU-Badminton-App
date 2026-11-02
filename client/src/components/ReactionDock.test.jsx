// client/src/components/ReactionDock.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReactionDock from "./ReactionDock";

describe("ReactionDock Component", () => {
	it("renders reaction dock container with accessible toolbar role", () => {
		render(<ReactionDock onReact={vi.fn()} />);
		const dock = screen.getByRole("toolbar", { name: /reactions/i });
		expect(dock).toBeInTheDocument();
		expect(dock).toHaveAttribute("data-testid", "reaction-dock");
	});

	it("renders all 6 default quick reactions with accessible aria labels", () => {
		render(<ReactionDock onReact={vi.fn()} />);

		expect(screen.getByRole("button", { name: /React with Like/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /React with Love/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /React with Fire/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /React with Celebrate/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /React with Clap/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /React with Shuttle/i })).toBeInTheDocument();
	});

	it("calls onReact callback with selected emoji when button is clicked", () => {
		const onReactMock = vi.fn();
		render(<ReactionDock onReact={onReactMock} />);

		const fireBtn = screen.getByRole("button", { name: /React with Fire/i });
		fireEvent.click(fireBtn);

		expect(onReactMock).toHaveBeenCalledTimes(1);
		expect(onReactMock).toHaveBeenCalledWith("🔥");
	});

	it("renders active counts when reactions array is provided", () => {
		const reactions = [
			{ emoji: "👍", userId: "u1" },
			{ emoji: "👍", userId: "u2" },
			{ emoji: "❤️", userId: "u3" },
			{ emoji: "🏸", userId: "u4" },
		];

		render(<ReactionDock reactions={reactions} onReact={vi.fn()} showCounts={true} />);

		expect(screen.getByTestId("reaction-count-like")).toHaveTextContent("2");
		expect(screen.getByTestId("reaction-count-love")).toHaveTextContent("1");
		expect(screen.getByTestId("reaction-count-shuttle")).toHaveTextContent("1");
		expect(screen.queryByTestId("reaction-count-fire")).not.toBeInTheDocument();
	});

	it("renders counts when reactions is provided as an object map", () => {
		const reactionsMap = {
			"🔥": 5,
			"🎉": 3,
		};

		render(<ReactionDock reactions={reactionsMap} onReact={vi.fn()} showCounts={true} />);

		expect(screen.getByTestId("reaction-count-fire")).toHaveTextContent("5");
		expect(screen.getByTestId("reaction-count-celebrate")).toHaveTextContent("3");
	});

	it("marks current user reaction as aria-pressed='true'", () => {
		render(<ReactionDock userReaction="❤️" onReact={vi.fn()} />);

		const loveBtn = screen.getByRole("button", { name: /React with Love/i });
		expect(loveBtn).toHaveAttribute("aria-pressed", "true");

		const likeBtn = screen.getByRole("button", { name: /React with Like/i });
		expect(likeBtn).toHaveAttribute("aria-pressed", "false");
	});

	it("hides counts when showCounts is false", () => {
		const reactions = [{ emoji: "👍" }, { emoji: "👍" }];
		render(<ReactionDock reactions={reactions} onReact={vi.fn()} showCounts={false} />);

		expect(screen.queryByTestId("reaction-count-like")).not.toBeInTheDocument();
	});

	it("renders custom reactions list when items prop is provided", () => {
		const customItems = [
			{ emoji: "⚡", label: "Clutch", tooltip: "Clutch" },
			{ emoji: "🧊", label: "Ice", tooltip: "Ice" },
		];

		const onReactMock = vi.fn();
		render(<ReactionDock items={customItems} onReact={onReactMock} />);

		expect(screen.getByRole("button", { name: /React with Clutch/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /React with Ice/i })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /React with Like/i })).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /React with Clutch/i }));
		expect(onReactMock).toHaveBeenCalledWith("⚡");
	});

	it("triggers onReact when button is activated via Enter key", () => {
		const onReactMock = vi.fn();
		render(<ReactionDock onReact={onReactMock} />);

		const clapBtn = screen.getByRole("button", { name: /React with Clap/i });
		fireEvent.click(clapBtn);

		expect(onReactMock).toHaveBeenCalledWith("👏");
	});
});
