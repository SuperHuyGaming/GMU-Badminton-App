// client/src/context/FeedbackContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from "react";

const FeedbackContext = createContext(null);
const DRAFT_STORAGE_KEY = "mbc_feedback_draft_v1";

export function FeedbackProvider({ children }) {
	const [isOpen, setIsOpen] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);
	const [initialData, setInitialData] = useState({
		type: "bug",
		severity: "medium",
		pageUrl: "",
	});

	// Load persistent draft from sessionStorage
	const [draft, setDraftState] = useState(() => {
		try {
			if (typeof window !== "undefined" && window.sessionStorage) {
				const saved = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
				return saved ? JSON.parse(saved) : null;
			}
			return null;
		} catch {
			return null;
		}
	});

	const saveDraft = useCallback((draftData) => {
		setDraftState(draftData);
		try {
			if (typeof window !== "undefined" && window.sessionStorage) {
				if (draftData) {
					window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
				} else {
					window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
				}
			}
		} catch (e) {
			console.warn("Could not save feedback draft", e);
		}
	}, []);

	const clearDraft = useCallback(() => {
		setDraftState(null);
		try {
			if (typeof window !== "undefined" && window.sessionStorage) {
				window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
			}
		} catch (e) {
			console.warn("Could not clear feedback draft", e);
		}
	}, []);

	const openFeedbackModal = useCallback((options = {}) => {
		setInitialData({
			type: options.type || options.initialType || "bug",
			severity: options.severity || options.initialSeverity || "medium",
			pageUrl: options.pageUrl || (typeof window !== "undefined" ? window.location.pathname : ""),
		});
		setIsMinimized(false);
		setIsOpen(true);
	}, []);

	const closeFeedbackModal = useCallback(() => {
		setIsOpen(false);
		setIsMinimized(false);
	}, []);

	const minimizeFeedbackModal = useCallback(() => {
		setIsMinimized(true);
	}, []);

	const maximizeFeedbackModal = useCallback(() => {
		setIsMinimized(false);
		setIsOpen(true);
	}, []);

	return (
		<FeedbackContext.Provider
			value={{
				isOpen,
				isMinimized,
				draft,
				initialData,
				openFeedbackModal,
				closeFeedbackModal,
				minimizeFeedbackModal,
				maximizeFeedbackModal,
				saveDraft,
				clearDraft,
			}}
		>
			{children}
		</FeedbackContext.Provider>
	);
}

export function useFeedback() {
	const context = useContext(FeedbackContext);
	if (!context) {
		return {
			isOpen: false,
			isMinimized: false,
			draft: null,
			initialData: { type: "bug", severity: "medium", pageUrl: "" },
			openFeedbackModal: () => {},
			closeFeedbackModal: () => {},
			minimizeFeedbackModal: () => {},
			maximizeFeedbackModal: () => {},
			saveDraft: () => {},
			clearDraft: () => {},
		};
	}
	return context;
}

export default FeedbackContext;

