// client/src/hooks/useMentionAutocomplete.test.jsx
import { useRef, useState } from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	useMentionAutocomplete,
	getMentionMatch,
	renderContentWithMentions,
} from "./useMentionAutocomplete";

describe("useMentionAutocomplete Hook & Utilities", () => {
	describe("getMentionMatch helper", () => {
		it("returns null for non-string or missing cursor", () => {
			expect(getMentionMatch(null, 0)).toBeNull();
			expect(getMentionMatch("hello", null)).toBeNull();
		});

		it("returns null when no @ is present", () => {
			expect(getMentionMatch("Hello world", 11)).toBeNull();
		});

		it("detects @ at the start of input", () => {
			const match = getMentionMatch("@john", 5);
			expect(match).toEqual({
				query: "john",
				atIndex: 0,
				cursorPosition: 5,
			});
		});

		it("detects @ after whitespace", () => {
			const match = getMentionMatch("Hello @jane", 11);
			expect(match).toEqual({
				query: "jane",
				atIndex: 6,
				cursorPosition: 11,
			});
		});

		it("detects single @ symbol with empty query", () => {
			const match = getMentionMatch("Hey @", 5);
			expect(match).toEqual({
				query: "",
				atIndex: 4,
				cursorPosition: 5,
			});
		});
	});

	describe("renderContentWithMentions helper", () => {
		it("returns raw text when no mentions are found", () => {
			expect(renderContentWithMentions("Just hitting around today")).toBe("Just hitting around today");
		});

		it("renders clickable mention chips for @User tokens", () => {
			const onMentionClick = vi.fn();
			render(
				<div>
					{renderContentWithMentions("Great game @Alex Lee and @Sam!", { onMentionClick })}
				</div>
			);

			const alexChip = screen.getByTestId("mention-chip-alex-lee");
			expect(alexChip).toBeInTheDocument();
			expect(alexChip).toHaveTextContent("@Alex Lee");

			fireEvent.click(alexChip);
			expect(onMentionClick).toHaveBeenCalledWith("Alex Lee", undefined);

			fireEvent.keyDown(alexChip, { key: "Enter" });
			expect(onMentionClick).toHaveBeenCalledTimes(2);
		});

		it("navigates to user profile if userMap and navigate are provided", () => {
			const navigate = vi.fn();
			const userMap = new Map([["Alex Lee", "user-123"]]);
			render(
				<div>
					{renderContentWithMentions("Thanks @Alex Lee", { navigate, userMap })}
				</div>
			);

			const chip = screen.getByTestId("mention-chip-alex-lee");
			fireEvent.click(chip);
			expect(navigate).toHaveBeenCalledWith("/profile/user-123");
		});
	});

	describe("useMentionAutocomplete Hook in Component", () => {
		const mockUsers = [
			{ _id: "u1", id: "u1", name: "Alice Smith", role: "player", skillLevel: "Advanced" },
			{ _id: "u2", id: "u2", name: "Bob Johnson", role: "coach", skillLevel: "Intermediate" },
		];

		const TestComponent = ({ initialText = "", customFetch }) => {
			const [text, setText] = useState(initialText);
			const inputRef = useRef(null);
			const {
				isOpen,
				suggestions,
				selectedIndex,
				handleKeyDown,
				selectSuggestion,
				closeSuggestions,
			} = useMentionAutocomplete({
				text,
				setText,
				inputRef,
				debounceMs: 50,
				customFetch,
			});

			return (
				<div>
					<textarea
						ref={inputRef}
						data-testid="mention-textarea"
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={handleKeyDown}
					/>
					{isOpen && (
						<ul data-testid="suggestions-list">
							{suggestions.map((u, i) => (
								<li key={u._id}>
									<button
										type="button"
										data-testid={`suggestion-item-${i}`}
										className={i === selectedIndex ? "active" : ""}
										onClick={() => selectSuggestion(u)}
									>
										{u.name} ({u.skillLevel})
									</button>
								</li>
							))}
						</ul>
					)}
					<button data-testid="close-btn" onClick={closeSuggestions}>
						Close
					</button>
				</div>
			);
		};

		let mockFetch;
		beforeEach(() => {
			mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ users: mockUsers }),
			});
		});

		it("opens suggestion dropdown when typing @", async () => {
			render(<TestComponent initialText="" customFetch={mockFetch} />);
			const textarea = screen.getByTestId("mention-textarea");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "Hello @" } });
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
				expect(screen.getByText(/Alice Smith/i)).toBeInTheDocument();
				expect(screen.getByText(/Bob Johnson/i)).toBeInTheDocument();
			});

			expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/forum/members?q="));
		});

		it("navigates suggestions with ArrowDown, ArrowUp and selects with Enter", async () => {
			render(<TestComponent initialText="" customFetch={mockFetch} />);
			const textarea = screen.getByTestId("mention-textarea");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "Hi @Al" } });
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
			});

			const firstItem = screen.getByTestId("suggestion-item-0");
			expect(firstItem).toHaveClass("active");

			// Arrow down to Bob
			fireEvent.keyDown(textarea, { key: "ArrowDown" });
			const secondItem = screen.getByTestId("suggestion-item-1");
			expect(secondItem).toHaveClass("active");

			// Press Enter to select Bob Johnson
			await act(async () => {
				fireEvent.keyDown(textarea, { key: "Enter" });
			});

			// Dropdown closes and text replaced
			await waitFor(() => {
				expect(screen.queryByTestId("suggestions-list")).not.toBeInTheDocument();
			});
			expect(textarea.value).toBe("Hi @Bob Johnson ");
		});

		it("selects suggestion on click and replaces text with @User Name ", async () => {
			render(<TestComponent initialText="" customFetch={mockFetch} />);
			const textarea = screen.getByTestId("mention-textarea");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "@" } });
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
			});

			const aliceOption = screen.getByText(/Alice Smith/i);
			await act(async () => {
				fireEvent.click(aliceOption);
			});

			await waitFor(() => {
				expect(screen.queryByTestId("suggestions-list")).not.toBeInTheDocument();
			});
			expect(textarea.value).toBe("@Alice Smith ");
		});

		it("closes suggestions on Escape key", async () => {
			render(<TestComponent initialText="" customFetch={mockFetch} />);
			const textarea = screen.getByTestId("mention-textarea");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "Meet me @" } });
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-list")).toBeInTheDocument();
			});

			fireEvent.keyDown(textarea, { key: "Escape" });

			await waitFor(() => {
				expect(screen.queryByTestId("suggestions-list")).not.toBeInTheDocument();
			});
		});

		it("gracefully handles API errors by keeping list closed", async () => {
			const failingFetch = vi.fn().mockRejectedValue(new Error("Network Error"));
			render(<TestComponent initialText="" customFetch={failingFetch} />);
			const textarea = screen.getByTestId("mention-textarea");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "@broken" } });
			});

			await waitFor(() => {
				expect(screen.queryByTestId("suggestions-list")).not.toBeInTheDocument();
			});
		});
	});
});
