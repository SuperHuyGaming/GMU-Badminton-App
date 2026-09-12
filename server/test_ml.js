const { analyzeContent } = require('./utils/aiModeration');

console.log("Starting tests...");

const tests = [
    "I love badminton, it is a great sport!",
    "click here for free money",
    "a".repeat(1000)
];

tests.forEach(t => {
    console.log(`\nTesting: "${t.substring(0, 50)}${t.length > 50 ? '...' : ''}"`);
    console.time("analyze");
    console.log(`Result:`, analyzeContent(t));
    console.timeEnd("analyze");
});
console.log("Done!");
