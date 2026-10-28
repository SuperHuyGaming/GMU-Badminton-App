// client/src/hooks/useMentionAutocomplete.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import apiFetch from "../utils/api";

/**
 * Helper: extract mention query and cursor position from text.
 * Matches '@' at the start of a string or preceded by whitespace,
 * capturing alphanumeric, period, underscore, or hyphen characters.
 */
export const getMentionMatch = (value, cursorPosition) => {
	if (typeof value !== "string" || cursorPosition === undefined || cursorPosition === null) {
		return null;
	}
	const textBeforeCursor = value.slice(0, cursorPosition);
	// Match '@' followed by non-space chars up to cursor
	const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
	if (!match) return null;

	const query = match[1] || "";
	// Calculate the exact index of '@'
	const atIndex = match.index + (match[0].startsWith("@") ? 0 : 1);

	return {
		query,
		atIndex,
		cursorPosition,
	};
};

/**
 * Helper: parse text content containing @User Name or @username
 * and return formatted elements with clickable mention chips.
 */
export const renderContentWithMentions = (content, options = {}) => {
	if (!content || typeof content !== "string") return content || null;
	if (!content.includes("@")) return content;
	const { onMentionClick, navigate, userMap = new Map() } = options;

	// Regex matching @ followed by 1 to 3 words (names like @John Doe or @Jane)
	const mentionRegex = /(@[a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)?)/g;
	const parts = content.split(mentionRegex);
	if (parts.length === 1 && !parts[0].startsWith("@")) return content;

	return parts.map((part, idx) => {
		if (part && part.startsWith("@")) {
			const rawName = part.substring(1).trim();
			const userId = userMap instanceof Map ? userMap.get(rawName) : userMap?.[rawName];

			const handleClick = (e) => {
				e?.stopPropagation();
				if (onMentionClick) {
					onMentionClick(rawName, userId);
				} else if (navigate && userId) {
					navigate(`/profile/${userId}`);
				}
			};

			const handleKeyDown = (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleClick(e);
				}
			};

			return React.createElement(
				"span",
				{
					key: idx,
					role: "link",
					tabIndex: 0,
					"data-testid": `mention-chip-${rawName.replace(/\s+/g, "-").toLowerCase()}`,
					"aria-label": `Mentioned user ${rawName}`,
					onClick: handleClick,
					onKeyDown: handleKeyDown,
					style: {
						color: "#006633",
						backgroundColor: "rgba(0, 102, 51, 0.12)",
						fontWeight: "bold",
						padding: "2px 6px",
						borderRadius: "6px",
						cursor: "pointer",
						display: "inline-block",
						margin: "0 2px",
						textDecoration: "none",
						transition: "background-color 0.2s ease",
					},
				},
				part
			);
		}
		return part;
	});
};

/**
 * Reusable React Hook for user mention autocomplete (@mentions) in inputs/textareas.
 */
export function useMentionAutocomplete({
	text = "",
	setText,
	inputRef,
	apiEndpoint = "/api/forum/members",
	debounceMs = 150,
	limit = 10,
	customFetch,
} = {}) {
	const [isOpen, setIsOpen] = useState(false);
	const [suggestions, setSuggestions] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [mentionMatch, setMentionMatch] = useState(null);

	const fetchRef = useRef(customFetch || apiFetch);
	useEffect(() => {
		fetchRef.current = customFetch || apiFetch;
	}, [customFetch]);

	const latestRequestRef = useRef(0);

	// Detect mention under cursor whenever text changes
	const updateMentionState = useCallback(() => {
		const el = inputRef?.current;
		const cursor = el?.selectionStart ?? text.length;
		const match = getMentionMatch(text, cursor);

		if (match) {
			setMentionMatch(match);
		} else {
			setMentionMatch(null);
			setIsOpen(false);
			setSuggestions([]);
			setSelectedIndex(0);
		}
	}, [text, inputRef]);

	useEffect(() => {
		updateMentionState();
	}, [updateMentionState]);

	// Fetch suggestions when mentionMatch is active
	useEffect(() => {
		if (!mentionMatch) {
			return;
		}

		const requestId = ++latestRequestRef.current;

		const timer = setTimeout(async () => {
			setIsLoading(true);
			try {
				const query = mentionMatch.query.trim();
				const url = `${apiEndpoint}?q=${encodeURIComponent(query)}&limit=${limit}`;
				const res = await fetchRef.current(url);
				if (requestId !== latestRequestRef.current) return;

				if (res && res.ok) {
					const data = await res.json();
					if (requestId !== latestRequestRef.current) return;
					const members = Array.isArray(data)
						? data
						: data.users || data.members || [];
					setSuggestions(members);
					setIsOpen(members.length > 0);
					setSelectedIndex(0);
				} else {
					setSuggestions([]);
					setIsOpen(false);
				}
			} catch (err) {
				if (requestId === latestRequestRef.current) {
					console.error("Mention search error:", err);
					setSuggestions([]);
					setIsOpen(false);
				}
			} finally {
				if (requestId === latestRequestRef.current) {
					setIsLoading(false);
				}
			}
		}, debounceMs);

		return () => {
			clearTimeout(timer);
		};
	}, [mentionMatch, apiEndpoint, limit, debounceMs]);

	/**
	 * Select a user suggestion and replace @query with @User Name
	 */
	const selectSuggestion = useCallback(
		(user) => {
			if (!user || !user.name || !mentionMatch) return;
			const { atIndex, cursorPosition } = mentionMatch;
			const replacement = `@${user.name} `;
			const before = text.slice(0, atIndex);
			const after = text.slice(cursorPosition);
			const newText = `${before}${replacement}${after}`;

			if (typeof setText === "function") {
				setText(newText);
			}

			setIsOpen(false);
			setSuggestions([]);
			setMentionMatch(null);
			setSelectedIndex(0);

			// Reposition cursor and refocus input
			const newCursorPos = atIndex + replacement.length;
			setTimeout(() => {
				if (inputRef?.current) {
					inputRef.current.focus();
					inputRef.current.selectionStart = newCursorPos;
					inputRef.current.selectionEnd = newCursorPos;
				}
			}, 0);

			return newText;
		},
		[mentionMatch, text, setText, inputRef]
	);

	const closeSuggestions = useCallback(() => {
		setIsOpen(false);
		setSuggestions([]);
		setSelectedIndex(0);
	}, []);

	/**
	 * Keyboard navigation handler for the input/textarea.
	 */
	const handleKeyDown = useCallback(
		(e) => {
			if (!isOpen || suggestions.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev + 1) % suggestions.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
			} else if (e.key === "Enter" || e.key === "Tab") {
				if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
					e.preventDefault();
					selectSuggestion(suggestions[selectedIndex]);
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				closeSuggestions();
			}
		},
		[isOpen, suggestions, selectedIndex, selectSuggestion, closeSuggestions]
	);

	return {
		isOpen,
		suggestions,
		isLoading,
		selectedIndex,
		mentionQuery: mentionMatch?.query ?? "",
		mentionMatch,
		handleKeyDown,
		selectSuggestion,
		closeSuggestions,
		setSelectedIndex,
		updateMentionState,
	};
}

export default useMentionAutocomplete;
