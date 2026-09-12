// server/utils/profanityFilter.js

const BAD_WORDS = [
	"fuck", "shit", "bitch", "asshole", "cunt", 
	"dick", "pussy", "faggot", "nigger", "slut", "whore"
];

// Returns true if the text contains profanity
const containsProfanity = (text) => {
	if (!text) return false;
	const lowerText = text.toLowerCase();
	
	for (let word of BAD_WORDS) {
		// Use word boundary to avoid matching "ass" in "class"
		const regex = new RegExp(`\\b${word}\\b`, "i");
		if (regex.test(lowerText)) {
			return true;
		}
	}
	return false;
};

module.exports = { containsProfanity };
