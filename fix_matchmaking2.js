const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'routes', 'matchmaking.js');
let code = fs.readFileSync(filePath, 'utf8');

const startStr = '// GET: /api/matchmaking/discover';
const endStr = '});'; // Actually, let's just find the last end of the discover block
const nextBlockStr = '// GET: /api/matchmaking/generate-bracket';

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(nextBlockStr);

if (startIdx !== -1 && endIdx !== -1) {
    const part1 = code.substring(0, startIdx);
    const part2 = code.substring(endIdx);
    
    const newCode = fs.readFileSync('new_code.txt', 'utf8');
    
    fs.writeFileSync(filePath, part1 + newCode + '\n' + part2);
    console.log("Success");
} else {
    console.log("Could not find start or end index", startIdx, endIdx);
}
