// client/src/context/FeedbackContext.jsx
import { createContext, useContext, useState, useCallback } from "react";

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
	const [isOpen, setIsOpen] = useState(false);
	const [initialData, setInitialData] = useState({
		type: "bug",
		severity: "medium",
		pageUrl: "",
	});

	const openFeedbackModal = useCallback((options = {}) => {
		setInitialData({
			type: options.type || options.initialType || "bug",
			severity: options.severity || options.initialSeverity || "medium",
			pageUrl: options.pageUrl || (typeof window !== "undefined" ? window.location.pathname : ""),
		});
		setIsOpen(true);
	}, []);

	const closeFeedbackModal = useCallback(() => {
		setIsOpen(false);
	}, []);

	return (
		<FeedbackContext.Provider
			value={{
				isOpen,
				initialData,
				openFeedbackModal,
				closeFeedbackModal,
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
			initialData: { type: "bug", severity: "medium", pageUrl: "" },
			openFeedbackModal: () => {},
			closeFeedbackModal: () => {},
		};
	}
	return context;
}

export default FeedbackContext;
