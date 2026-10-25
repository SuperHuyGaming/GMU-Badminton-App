const fs = require('fs');
const path = require('path');

const planPath = path.resolve(__dirname, '../../enterprise_tournament_platform_50_sprint_plan.md');
const content = fs.readFileSync(planPath, 'utf8');

const roles = [
  { code: 'FSE', name: 'Full Stack Engineer' },
  { code: 'BSE', name: 'Backend & Distributed Systems Engineer' },
  { code: 'FME', name: 'Frontend & Mobile Web Engineer' },
  { code: 'AIM', name: 'AI & Machine Learning Engineer' },
  { code: 'UXD', name: 'UX/UI & Accessibility Designer' },
  { code: 'SEC', name: 'Security & Compliance Engineer' },
  { code: 'QAE', name: 'Software Test & Quality Assurance Lead' },
  { code: 'DOP', name: 'DevOps & Platform Reliability Engineer' },
  { code: 'DAA', name: 'Data Architect & Analytics Engineer' },
  { code: 'TOP', name: 'Tournament Operations & Product Manager' }
];

console.log('--- Analyzing 200 Initiatives in 50-Sprint Plan ---');
let totalFound = 0;
let missing = [];

roles.forEach((r, idx) => {
  let count = 0;
  for (let i = 1; i <= 20; i++) {
    const num = i < 10 ? '0' + i : '' + i;
    const tag = `${r.code}-${num}`;
    const regex = new RegExp(`\\b${tag}\\b`, 'i');
    if (regex.test(content)) {
      count++;
    } else {
      missing.push(tag);
    }
  }
  console.log(`Role ${idx + 1} [${r.code}] ${r.name}: ${count}/20 initiatives`);
  totalFound += count;
});

console.log(`\nTotal verified initiatives: ${totalFound}/200`);
if (missing.length > 0) {
  console.log('Missing tags:', missing.join(', '));
} else {
  console.log('ALL 200 INITIATIVES PRESENT AND VERIFIED!');
}
