const fs = require('fs');
const file = 'D:/GMU Badminton App/client/src/pages/Messages.jsx';
let content = fs.readFileSync(file, 'utf8');

// Remove the old arrow function
const oldFuncRegex = /[ \t]*const startNewChat = \(friend\) => \{[\s\S]*?\};\r?\n/;
content = content.replace(oldFuncRegex, '');

// Insert the regular function before the first useEffect
content = content.replace('useEffect(() => {', `function startNewChat(friend) {
		setActiveChat(friend);
		setSearchQuery("");
		setSearchResults([]);
	}

	useEffect(() => {`);

fs.writeFileSync(file, content);
console.log('Fixed Messages.jsx');
