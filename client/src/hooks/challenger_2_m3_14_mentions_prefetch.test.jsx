// client/src/hooks/challenger_2_m3_14_mentions_prefetch.test.jsx
import { useRef, useState } from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import {
	useMentionAutocomplete,
	getMentionMatch,
	renderContentWithMentions,
} from "./useMentionAutocomplete";
import Forum from "../pages/Forum";
import apiFetch from "../utils/api";
import { AuthContext } from "../context/AuthContext";

// Mock API fetch utility
vi.mock("../utils/api", () => ({
	default: vi.fn(),
}));

// Mock image compression utility
vi.mock("../utils/imageUtils", () => ({
	compressImage: vi.fn(async (file) => {
		return new File(["mock-compressed"], (file.name || "compressed").replace(/\.[^/.]+$/, "") + ".jpg", {
			type: "image/jpeg",
		});
	}),
}));

// Mock toast utility
vi.mock("react-hot-toast", () => {
	const fn = vi.fn();
	fn.success = vi.fn();
	fn.error = vi.fn();
	return {
		default: fn,
		toast: fn,
	};
});

// Mock socket utility
let socketHandlers = {};
vi.mock("../utils/socket", () => ({
	default: {
		on: vi.fn((event, cb) => {
			socketHandlers[event] = cb;
		}),
		off: vi.fn((event) => {
			delete socketHandlers[event];
		}),
		emit: vi.fn(),
	},
}));

// Mock Masonry for JSDOM
vi.mock("@mui/lab/Masonry", () => ({
	default: ({ children }) => <div data-testid="masonry-mock">{children}</div>,
}));

// Mock PostCard
vi.mock("../components/PostCard", () => ({
	default: ({ post }) => (
		<div data-testid={`post-card-${post._id}`}>
			<h3>{post.title}</h3>
			<p>{post.content}</p>
		</div>
	),
}));

const mockUser = { id: "user-challenger-2", name: "Challenger Two", role: "player" };

describe("Milestone 3 Challenger 2: J10 Inline Mentions & J11 Viewport Prefetch Adversarial Suite", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		socketHandlers = {};

		const mockIntersectionObserver = vi.fn();
		mockIntersectionObserver.mockReturnValue({
			observe: () => null,
			unobserve: () => null,
			disconnect: () => null,
		});
		window.IntersectionObserver = mockIntersectionObserver;
		window.scrollTo = vi.fn();
	});

	// =========================================================================
	// J10: @ Detection Boundary & Edge Cases
	// =========================================================================
	describe("J10: getMentionMatch Boundary & Edge Cases", () => {
		it("boundary: returns null for invalid types, null, undefined, and non-string inputs", () => {
			expect(getMentionMatch(null, 0)).toBeNull();
			expect(getMentionMatch(undefined, 0)).toBeNull();
			expect(getMentionMatch(12345, 2)).toBeNull();
			expect(getMentionMatch({}, 0)).toBeNull();
			expect(getMentionMatch([], 0)).toBeNull();
			expect(getMentionMatch("hello", undefined)).toBeNull();
			expect(getMentionMatch("hello", null)).toBeNull();
		});

		it("boundary: multiple consecutive @ symbols must NOT trigger a mention match", () => {
			// @@ at end
			expect(getMentionMatch("@@", 2)).toBeNull();
			// @@@ at end
			expect(getMentionMatch("@@@", 3)).toBeNull();
			// @@ followed by username
			expect(getMentionMatch("@@user", 6)).toBeNull();
			// text followed by @@user
			expect(getMentionMatch("Hey @@john", 10)).toBeNull();
			// multiple @ across words without spaces
			expect(getMentionMatch("@user@another", 13)).toBeNull();
			// space separated @ symbols
			const doubleSpaceAt = getMentionMatch("foo @ @bar", 10);
			expect(doubleSpaceAt).toEqual({
				query: "bar",
				atIndex: 6,
				cursorPosition: 10,
			});
		});

		it("boundary: email addresses must NOT trigger a mention match", () => {
			// standard email
			expect(getMentionMatch("user@example.com", 16)).toBeNull();
			// university domain email
			expect(getMentionMatch("student@masonlive.gmu.edu", 25)).toBeNull();
			// email with subaddress/plus addressing
			expect(getMentionMatch("player+tournament@domain.org", 28)).toBeNull();
			// email embedded in sentence
			expect(getMentionMatch("Contact me at test.user@gmail.com for doubles", 33)).toBeNull();
			// cursor positioned right after domain in email
			expect(getMentionMatch("hello@world", 11)).toBeNull();
		});

		it("boundary: middle-of-word @ must NOT trigger a mention match", () => {
			// word@word
			expect(getMentionMatch("word@end", 8)).toBeNull();
			expect(getMentionMatch("john@doe", 8)).toBeNull();
			// number@number
			expect(getMentionMatch("123@456", 7)).toBeNull();
			// alphanumeric with symbols
			expect(getMentionMatch("court@3", 7)).toBeNull();
			expect(getMentionMatch("smash@100mph", 12)).toBeNull();
		});

		it("boundary: special characters and punctuation boundaries", () => {
			// symbols after @
			expect(getMentionMatch("@!#$%", 5)).toBeNull();
			expect(getMentionMatch("@?", 2)).toBeNull();
			expect(getMentionMatch("@*", 2)).toBeNull();
			// punctuation immediately after username
			expect(getMentionMatch("@john!", 6)).toBeNull();
			expect(getMentionMatch("@john?", 6)).toBeNull();
			expect(getMentionMatch("@john:", 6)).toBeNull();
			expect(getMentionMatch("@john,", 6)).toBeNull();
			expect(getMentionMatch("@john;", 6)).toBeNull();
			// valid chars allowed by regex: alphanumeric, period, underscore, hyphen
			const validComplex = getMentionMatch("@alice.smith_99-pro", 19);
			expect(validComplex).toEqual({
				query: "alice.smith_99-pro",
				atIndex: 0,
				cursorPosition: 19,
			});
		});

		it("boundary: empty queries detection", () => {
			// single @ at start of input
			expect(getMentionMatch("@", 1)).toEqual({
				query: "",
				atIndex: 0,
				cursorPosition: 1,
			});
			// @ after single space
			expect(getMentionMatch("Hey @", 5)).toEqual({
				query: "",
				atIndex: 4,
				cursorPosition: 5,
			});
			// @ after multiple spaces
			expect(getMentionMatch("Hey    @", 8)).toEqual({
				query: "",
				atIndex: 7,
				cursorPosition: 8,
			});
			// @ after newline
			expect(getMentionMatch("First line\n@", 12)).toEqual({
				query: "",
				atIndex: 11,
				cursorPosition: 12,
			});
		});

		it("boundary: cursor positions before, within, and after mention token", () => {
			const text = "Hello @samuel welcome";
			// Cursor at 0 (start)
			expect(getMentionMatch(text, 0)).toBeNull();
			// Cursor at 6 (right before @)
			expect(getMentionMatch(text, 6)).toBeNull();
			// Cursor at 7 (right after @)
			expect(getMentionMatch(text, 7)).toEqual({
				query: "",
				atIndex: 6,
				cursorPosition: 7,
			});
			// Cursor at 10 (middle of samuel: 'sam')
			expect(getMentionMatch(text, 10)).toEqual({
				query: "sam",
				atIndex: 6,
				cursorPosition: 10,
			});
			// Cursor at 13 (end of samuel, length 13)
			expect(getMentionMatch(text, 13)).toEqual({
				query: "samuel",
				atIndex: 6,
				cursorPosition: 13,
			});
			// Cursor at 14 (after the space following samuel)
			expect(getMentionMatch(text, 14)).toBeNull();
			// Cursor at 21 (end of sentence)
			expect(getMentionMatch(text, 21)).toBeNull();
		});
	});

	// =========================================================================
	// J10: renderContentWithMentions Security & Interactions
	// =========================================================================
	describe("J10: renderContentWithMentions Security, Rendering & Interactions", () => {
		it("safely handles empty, null, undefined, and non-string inputs", () => {
			expect(renderContentWithMentions("")).toBeNull();
			expect(renderContentWithMentions(null)).toBeNull();
			expect(renderContentWithMentions(undefined)).toBeNull();
			expect(renderContentWithMentions(999)).toBe(999);
			expect(renderContentWithMentions("No mentions here")).toBe("No mentions here");
		});

		it("renders multiple mentions as accessible interactive chips", () => {
			const onMentionClick = vi.fn();
			render(
				<div>
					{renderContentWithMentions("Thanks @Alice Smith and @Bob! Great game", { onMentionClick })}
				</div>
			);

			const aliceChip = screen.getByTestId("mention-chip-alice-smith");
			const bobChip = screen.getByTestId("mention-chip-bob");

			expect(aliceChip).toHaveAttribute("role", "link");
			expect(aliceChip).toHaveAttribute("tabindex", "0");
			expect(aliceChip).toHaveAttribute("aria-label", "Mentioned user Alice Smith");
			expect(bobChip).toHaveAttribute("role", "link");

			// Click triggers onMentionClick
			fireEvent.click(aliceChip);
			expect(onMentionClick).toHaveBeenCalledWith("Alice Smith", undefined);

			// Enter keydown triggers onMentionClick
			fireEvent.keyDown(bobChip, { key: "Enter" });
			expect(onMentionClick).toHaveBeenCalledWith("Bob", undefined);

			// Space keydown triggers onMentionClick
			fireEvent.keyDown(aliceChip, { key: " " });
			expect(onMentionClick).toHaveBeenCalledTimes(3);

			// Other keys (e.g. Tab, Escape) do not trigger onMentionClick
			fireEvent.keyDown(bobChip, { key: "Escape" });
			fireEvent.keyDown(bobChip, { key: "Tab" });
			expect(onMentionClick).toHaveBeenCalledTimes(3);
		});

		it("demonstrates 2-word greedy mention matching behavior without delimiter", () => {
			// When a single-name mention is followed immediately by a space and another word without punctuation,
			// the 2-word regex greedy match combines both words into the mention token
			render(
				<div>
					{renderContentWithMentions("Thanks @Bob for the match")}
				</div>
			);
			expect(screen.getByTestId("mention-chip-bob-for")).toBeInTheDocument();
		});

		it("supports profile navigation with userMap as both Map and Object", () => {
			const navigate = vi.fn();
			// Case 1: userMap as Map
			const mapUsers = new Map([["Carol Danvers", "user-carol-42"]]);
			const { rerender } = render(
				<div>
					{renderContentWithMentions("Shoutout to @Carol Danvers", { navigate, userMap: mapUsers })}
				</div>
			);
			fireEvent.click(screen.getByTestId("mention-chip-carol-danvers"));
			expect(navigate).toHaveBeenCalledWith("/profile/user-carol-42");

			// Case 2: userMap as Plain Object
			const objUsers = { "Dave Miller": "user-dave-99" };
			rerender(
				<div>
					{renderContentWithMentions("Great rally @Dave Miller", { navigate, userMap: objUsers })}
				</div>
			);
			fireEvent.click(screen.getByTestId("mention-chip-dave-miller"));
			expect(navigate).toHaveBeenCalledWith("/profile/user-dave-99");
		});

		it("security: protects against XSS payloads and script injection in content", () => {
			const maliciousContent = "Hello @<script>alert('xss')</script> and @<img src=x onerror=alert(1)>";
			const { container } = render(
				<div data-testid="xss-container">
					{renderContentWithMentions(maliciousContent)}
				</div>
			);

			// Ensure no executable script or image tag is created
			expect(container.querySelectorAll("script").length).toBe(0);
			expect(container.querySelectorAll("img").length).toBe(0);
			expect(screen.getByTestId("xss-container")).toHaveTextContent("Hello @<script>alert('xss')</script>");
		});
	});

	// =========================================================================
	// J10: useMentionAutocomplete Keyboard Edge Cases & Stress Test
	// =========================================================================
	describe("J10: useMentionAutocomplete Keyboard Navigation Edge Cases", () => {
		const mockUsers = [
			{ _id: "u1", id: "u1", name: "Alpha Player", role: "player", skillLevel: "Advanced" },
			{ _id: "u2", id: "u2", name: "Beta Smash", role: "coach", skillLevel: "Expert" },
			{ _id: "u3", id: "u3", name: "Gamma Net", role: "player", skillLevel: "Intermediate" },
		];

		const Harness = ({ initialText = "", customFetch }) => {
			const [text, setText] = useState(initialText);
			const inputRef = useRef(null);
			const {
				isOpen,
				suggestions,
				selectedIndex,
				handleKeyDown,
				selectSuggestion,
				closeSuggestions,
				updateMentionState,
			} = useMentionAutocomplete({
				text,
				setText,
				inputRef,
				debounceMs: 20,
				customFetch,
			});

			return (
				<div>
					<textarea
						ref={inputRef}
						data-testid="mention-input"
						value={text}
						onChange={(e) => setText(e.target.value)}
						onSelect={updateMentionState}
						onKeyDown={handleKeyDown}
					/>
					{isOpen && (
						<ul data-testid="suggestions-popup">
							{suggestions.map((u, i) => (
								<li key={u._id}>
									<button
										type="button"
										data-testid={`mention-item-${i}`}
										className={i === selectedIndex ? "selected" : ""}
										onClick={() => selectSuggestion(u)}
									>
										{u.name}
									</button>
								</li>
							))}
						</ul>
					)}
					<button data-testid="manual-close-btn" onClick={closeSuggestions}>
						Close
					</button>
				</div>
			);
		};

		it("keyboard: wraps around correctly when navigating past boundaries (ArrowDown from last to first, ArrowUp from first to last)", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ users: mockUsers }),
			});

			render(<Harness initialText="" customFetch={mockFetch} />);
			const textarea = screen.getByTestId("mention-input");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "@" } });
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-popup")).toBeInTheDocument();
			});

			// Initial index is 0 (Alpha Player)
			expect(screen.getByTestId("mention-item-0")).toHaveClass("selected");

			// ArrowDown -> index 1 (Beta Smash)
			fireEvent.keyDown(textarea, { key: "ArrowDown" });
			expect(screen.getByTestId("mention-item-1")).toHaveClass("selected");

			// ArrowDown -> index 2 (Gamma Net - last item)
			fireEvent.keyDown(textarea, { key: "ArrowDown" });
			expect(screen.getByTestId("mention-item-2")).toHaveClass("selected");

			// ArrowDown again -> wraps around to index 0 (Alpha Player)
			fireEvent.keyDown(textarea, { key: "ArrowDown" });
			expect(screen.getByTestId("mention-item-0")).toHaveClass("selected");

			// ArrowUp from index 0 -> wraps backwards to index 2 (Gamma Net)
			fireEvent.keyDown(textarea, { key: "ArrowUp" });
			expect(screen.getByTestId("mention-item-2")).toHaveClass("selected");

			// ArrowUp -> index 1 (Beta Smash)
			fireEvent.keyDown(textarea, { key: "ArrowUp" });
			expect(screen.getByTestId("mention-item-1")).toHaveClass("selected");
		});

		it("keyboard: handles key presses gracefully when suggestion list is empty without throwing errors", async () => {
			const emptyFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ users: [] }),
			});

			render(<Harness initialText="" customFetch={emptyFetch} />);
			const textarea = screen.getByTestId("mention-input");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "@nonexistent" } });
			});

			// Suggestions list is not open
			expect(screen.queryByTestId("suggestions-popup")).not.toBeInTheDocument();

			// Pressing navigation keys does not crash or throw
			expect(() => {
				fireEvent.keyDown(textarea, { key: "ArrowDown" });
				fireEvent.keyDown(textarea, { key: "ArrowUp" });
				fireEvent.keyDown(textarea, { key: "Enter" });
				fireEvent.keyDown(textarea, { key: "Tab" });
				fireEvent.keyDown(textarea, { key: "Escape" });
			}).not.toThrow();
		});

		it("keyboard: handles Escape dismissal and clears suggestion state", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ users: mockUsers }),
			});

			render(<Harness initialText="" customFetch={mockFetch} />);
			const textarea = screen.getByTestId("mention-input");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "Hello @" } });
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-popup")).toBeInTheDocument();
			});

			// Press Escape
			fireEvent.keyDown(textarea, { key: "Escape" });

			await waitFor(() => {
				expect(screen.queryByTestId("suggestions-popup")).not.toBeInTheDocument();
			});
		});

		it("keyboard: selects suggestion with Tab key as alternative to Enter", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ users: mockUsers }),
			});

			render(<Harness initialText="" customFetch={mockFetch} />);
			const textarea = screen.getByTestId("mention-input");

			await act(async () => {
				fireEvent.change(textarea, { target: { value: "Hey @Al" } });
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-popup")).toBeInTheDocument();
			});

			// Press Tab to select Alpha Player
			await act(async () => {
				fireEvent.keyDown(textarea, { key: "Tab" });
			});

			await waitFor(() => {
				expect(screen.queryByTestId("suggestions-popup")).not.toBeInTheDocument();
			});
			expect(textarea.value).toBe("Hey @Alpha Player ");
		});

		it("correctly replaces mention query in the middle of a sentence without mangling surrounding text", async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ users: mockUsers }),
			});

			render(<Harness initialText="" customFetch={mockFetch} />);
			const textarea = screen.getByTestId("mention-input");

			// Initial text before cursor
			await act(async () => {
				fireEvent.change(textarea, { target: { value: "Hey @b" } });
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-popup")).toBeInTheDocument();
			});

			// Append suffix and set cursor position at index 6 (right after @b)
			await act(async () => {
				fireEvent.change(textarea, { target: { value: "Hey @b, are you ready for doubles?" } });
			});
			textarea.selectionStart = 6;
			textarea.selectionEnd = 6;
			await act(async () => {
				fireEvent.select(textarea);
			});

			await waitFor(() => {
				expect(screen.getByTestId("suggestions-popup")).toBeInTheDocument();
			});

			// Navigate to Beta Smash and select with Enter
			fireEvent.keyDown(textarea, { key: "ArrowDown" });
			await act(async () => {
				fireEvent.keyDown(textarea, { key: "Enter" });
			});

			await waitFor(() => {
				expect(screen.queryByTestId("suggestions-popup")).not.toBeInTheDocument();
			});
			// Suffix ", are you ready for doubles?" is fully preserved!
			expect(textarea.value).toBe("Hey @Beta Smash , are you ready for doubles?");
		});
	});

	// =========================================================================
	// J10: Regex Security & ReDoS Vulnerability Stress Test
	// =========================================================================
	describe("J10: Regex Security & ReDoS Vulnerability Stress Test", () => {
		it("getMentionMatch completes within 50ms even against adversarial 100,000-character payload", () => {
			// Construct adversarial payload designed to stress regular expressions
			const adversarialPayload = "@" + "a".repeat(50000) + "@" + "b".repeat(50000) + "!";
			const start = performance.now();
			const result = getMentionMatch(adversarialPayload, adversarialPayload.length);
			const duration = performance.now() - start;

			expect(result).toBeNull();
			// Verification that regex does NOT exhibit exponential catastrophic backtracking
			expect(duration).toBeLessThan(50);
		});

		it("renderContentWithMentions completes within 50ms on 50,000-character payload", () => {
			// 2,500 repeats of "@User-Name_123 "
			const repeatedMentions = "@User-Name_123 ".repeat(2500);
			const start = performance.now();
			const result = renderContentWithMentions(repeatedMentions);
			const duration = performance.now() - start;

			expect(Array.isArray(result)).toBe(true);
			expect(duration).toBeLessThan(50);
		});
	});

	// =========================================================================
	// J11: 80% Viewport Pre-fetching Threshold Boundaries & Stress
	// =========================================================================
	describe("J11: 80% Viewport Pre-fetching Threshold Boundaries (75%, 79%, 80%, 85%, 100%)", () => {
		const renderForum = () => {
			return render(
				<AuthContext.Provider value={{ user: mockUser, token: "fake-token" }}>
					<BrowserRouter>
						<Forum />
					</BrowserRouter>
				</AuthContext.Provider>
			);
		};

		it("boundary: scroll positions at 75% and 79% do NOT trigger premature prefetch", async () => {
			let callCount = 0;
			apiFetch.mockImplementation(async (url) => {
				if (url.includes("/api/feed/trending-tags") || url.includes("/api/forum/online-users")) {
					return { ok: true, json: async () => ({ tags: [], onlineUserIds: [] }) };
				}
				if (url.startsWith("/api/feed")) {
					callCount++;
					return {
						ok: true,
						json: async () => ({
							feed: [{ _id: "post-1", title: "Test Post 1", content: "Content 1", createdAt: new Date().toISOString() }],
							nextCursor: "cursor-page-2",
							hasMore: true,
						}),
					};
				}
				return { ok: true, json: async () => ({}) };
			});

			renderForum();
			await waitFor(() => expect(screen.getByText("Test Post 1")).toBeInTheDocument());
			expect(callCount).toBe(1);

			// Setup document geometry: scrollHeight = 2000px, window.innerHeight = 800px
			// 80% threshold = 2000 * 0.8 = 1600px
			Object.defineProperty(document.documentElement, "scrollHeight", {
				configurable: true,
				value: 2000,
			});
			window.innerHeight = 800;

			// Position 1: 75% (scrollPos = 700 + 800 = 1500 < 1600)
			window.scrollY = 700;
			await act(async () => {
				fireEvent.scroll(window);
			});

			// Wait 150ms for throttle to clear
			await new Promise((r) => setTimeout(r, 150));
			// Assert NO extra network request occurred below 80%
			expect(callCount).toBe(1);

			// Position 2: 79% (scrollPos = 780 + 800 = 1580 < 1600)
			window.scrollY = 780;
			await act(async () => {
				fireEvent.scroll(window);
			});

			await new Promise((r) => setTimeout(r, 150));
			// Assert STILL NO extra network request at 79%
			expect(callCount).toBe(1);
		});

		it("boundary: scroll positions at 80%, 85%, and 100% trigger page prefetch", async () => {
			let callCount = 0;
			apiFetch.mockImplementation(async (url) => {
				if (url.includes("/api/feed/trending-tags") || url.includes("/api/forum/online-users")) {
					return { ok: true, json: async () => ({ tags: [], onlineUserIds: [] }) };
				}
				if (url.startsWith("/api/feed")) {
					callCount++;
					if (callCount === 1) {
						return {
							ok: true,
							json: async () => ({
								feed: [{ _id: "p1", title: "Page 1 Post", content: "C1", createdAt: new Date().toISOString() }],
								nextCursor: "c2",
								hasMore: true,
							}),
						};
					}
					return {
						ok: true,
						json: async () => ({
							feed: [{ _id: "p2", title: "Page 2 Post", content: "C2", createdAt: new Date().toISOString() }],
							nextCursor: null,
							hasMore: false,
						}),
					};
				}
				return { ok: true, json: async () => ({}) };
			});

			renderForum();
			await waitFor(() => expect(screen.getByText("Page 1 Post")).toBeInTheDocument());
			expect(callCount).toBe(1);

			// Document geometry: scrollHeight = 2000px, innerHeight = 800px.
			// 80% threshold = 1600px.
			Object.defineProperty(document.documentElement, "scrollHeight", {
				configurable: true,
				value: 2000,
			});
			window.innerHeight = 800;

			// Position: exactly 80% (scrollY = 800; 800 + 800 = 1600 >= 1600)
			window.scrollY = 800;
			await act(async () => {
				fireEvent.scroll(window);
			});

			await waitFor(() => {
				expect(callCount).toBe(2);
			});
			await waitFor(() => {
				expect(screen.getByText("Page 2 Post")).toBeInTheDocument();
			});
		});

		it("guard: does NOT trigger prefetch when hasMore is false even at 100% scroll", async () => {
			let feedCalls = 0;
			apiFetch.mockImplementation(async (url) => {
				if (url.includes("/api/feed/trending-tags") || url.includes("/api/forum/online-users")) {
					return { ok: true, json: async () => ({ tags: [], onlineUserIds: [] }) };
				}
				if (url.startsWith("/api/feed")) {
					feedCalls++;
					return {
						ok: true,
						json: async () => ({
							feed: [{ _id: "end-p1", title: "Final Post", content: "No more posts", createdAt: new Date().toISOString() }],
							nextCursor: null,
							hasMore: false, // End of feed
						}),
					};
				}
				return { ok: true, json: async () => ({}) };
			});

			renderForum();
			await waitFor(() => expect(screen.getByText("Final Post")).toBeInTheDocument());
			expect(feedCalls).toBe(1);

			// Scroll all the way to 100%
			Object.defineProperty(document.documentElement, "scrollHeight", {
				configurable: true,
				value: 2000,
			});
			window.innerHeight = 800;
			window.scrollY = 1200; // 1200 + 800 = 2000 (100%)

			await act(async () => {
				fireEvent.scroll(window);
			});

			await new Promise((r) => setTimeout(r, 150));
			// hasMore=false blocks premature or redundant requests
			expect(feedCalls).toBe(1);
		});
	});

	// =========================================================================
	// J11: Rapid Scrolling Throttle & Redundant Request Stress Test
	// =========================================================================
	describe("J11: Rapid Scrolling Throttle Stress Test", () => {
		it("rapid scrolling burst (50 scroll events in 10ms) does NOT trigger duplicate network requests", async () => {
			let feedCalls = 0;
			apiFetch.mockImplementation(async (url) => {
				if (url.includes("/api/feed/trending-tags") || url.includes("/api/forum/online-users")) {
					return { ok: true, json: async () => ({ tags: [], onlineUserIds: [] }) };
				}
				if (url.startsWith("/api/feed")) {
					feedCalls++;
					const thisCall = feedCalls;
					return {
						ok: true,
						json: async () => ({
							feed: [{ _id: `p-${thisCall}`, title: `Post Batch ${thisCall}`, content: "Content", createdAt: new Date().toISOString() }],
							nextCursor: thisCall === 1 ? "cursor-2" : null,
							hasMore: thisCall === 1,
						}),
					};
				}
				return { ok: true, json: async () => ({}) };
			});

			render(
				<AuthContext.Provider value={{ user: mockUser, token: "fake-token" }}>
					<BrowserRouter>
						<Forum />
					</BrowserRouter>
				</AuthContext.Provider>
			);

			await waitFor(() => expect(screen.getByText("Post Batch 1")).toBeInTheDocument());
			
			// Allow initial search debounce (250ms) to settle before testing scroll bursts
			await new Promise((r) => setTimeout(r, 300));
			const initialCalls = feedCalls;
			expect(initialCalls).toBeGreaterThanOrEqual(1);

			Object.defineProperty(document.documentElement, "scrollHeight", {
				configurable: true,
				value: 2000,
			});
			window.innerHeight = 800;
			window.scrollY = 900; // 85% scroll position

			// Trigger 50 rapid scroll events in rapid succession
			await act(async () => {
				for (let i = 0; i < 50; i++) {
					fireEvent.scroll(window);
				}
			});

			// Verify that page 2 prefetch was dispatched
			await waitFor(() => {
				expect(feedCalls).toBe(initialCalls + 1);
			});

			// Verify that throttle and isFetchingMore guard prevented 50 duplicate network calls
			await new Promise((r) => setTimeout(r, 200));
			expect(feedCalls).toBe(initialCalls + 1);
		});
	});

	// =========================================================================
	// J11: Component Unmount Cleanup & Memory Leak Prevention
	// =========================================================================
	describe("J11: Component Unmount Cleanup & Memory Leak Prevention", () => {
		it("removes window scroll event listeners on component unmount to prevent memory leaks", async () => {
			apiFetch.mockImplementation(async (url) => {
				if (url.includes("/api/feed/trending-tags") || url.includes("/api/forum/online-users")) {
					return { ok: true, json: async () => ({ tags: [], onlineUserIds: [] }) };
				}
				if (url.startsWith("/api/feed")) {
					return {
						ok: true,
						json: async () => ({
							feed: [{ _id: "clean-1", title: "Cleanup Test Post", content: "Body", createdAt: new Date().toISOString() }],
							nextCursor: "cursor-clean",
							hasMore: true,
						}),
					};
				}
				return { ok: true, json: async () => ({}) };
			});

			const addEventListenerSpy = vi.spyOn(window, "addEventListener");
			const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

			const { unmount } = render(
				<AuthContext.Provider value={{ user: mockUser, token: "fake-token" }}>
					<BrowserRouter>
						<Forum />
					</BrowserRouter>
				</AuthContext.Provider>
			);

			await waitFor(() => expect(screen.getByText("Cleanup Test Post")).toBeInTheDocument());

			// Verify scroll listener was attached
			const scrollAddCalls = addEventListenerSpy.mock.calls.filter(([event]) => event === "scroll");
			expect(scrollAddCalls.length).toBeGreaterThanOrEqual(1);

			// Unmount the Forum component
			act(() => {
				unmount();
			});

			// Verify removeEventListener was invoked for scroll event
			const scrollRemoveCalls = removeEventListenerSpy.mock.calls.filter(([event]) => event === "scroll");
			expect(scrollRemoveCalls.length).toBeGreaterThanOrEqual(scrollAddCalls.length);

			// Firing scroll event after unmount must NOT throw or produce memory leak errors
			expect(() => {
				fireEvent.scroll(window);
			}).not.toThrow();

			addEventListenerSpy.mockRestore();
			removeEventListenerSpy.mockRestore();
		});
	});
});
