
const fs = require("fs");
const path = require("path");

const userFile = path.join(__dirname, "server/models/User.js");
let content = fs.readFileSync(userFile, "utf-8");

content = content.replace(
`	// Calendar / RSVPs
	rsvpedTournaments: [{ type: String }], // Array of Tournament IDs

	lastActive: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },`,
`	// Calendar / RSVPs
	rsvpedTournaments: [{ type: String }], // Array of Tournament IDs

	// Task 8: Geospatial Court Check-in Search
	checkInLocation: { 
		type: String, 
		enum: ["RAC", "Skyline", "AFC", "None"], 
		default: "None" 
	},

	// Task 9: Looking to Play Now Queue
	inQueue: { type: Boolean, default: false },
	queueJoinedAt: { type: Date },

	// Task 11: Recommendation Engine V2
	preferredTimeOfDay: { 
		type: String, 
		enum: ["Morning", "Afternoon", "Evening", "Any"], 
		default: "Any" 
	},

	lastActive: { type: Date, default: Date.now },
	createdAt: { type: Date, default: Date.now },`
);

fs.writeFileSync(userFile, content);
console.log("Updated User.js");

