const fs = require('fs');
const path = require('path');

function scanDirectory(dir, issues = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath, issues);
    } else if (fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Check for IconButton without aria-label
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('<IconButton') && !line.includes('aria-label')) {
          // It might be on multiple lines, let's just do a naive check for now
          // Actually, let's use regex on the whole content
        }
      }

      // 1. Missing aria-label on IconButton
      let iconButtonMatches = content.matchAll(/<IconButton[^>]*>/g);
      for (const match of iconButtonMatches) {
        if (!match[0].includes('aria-label')) {
          issues.push({ file: fullPath, type: 'Missing aria-label on IconButton', match: match[0] });
        }
      }

      // 2. Missing alt on Avatar
      let avatarMatches = content.matchAll(/<Avatar[^>]*>/g);
      for (const match of avatarMatches) {
        // Avatars can have children as initials, so alt might not be strictly necessary, but good for a11y if it has src
        if (match[0].includes('src=') && !match[0].includes('alt=')) {
          issues.push({ file: fullPath, type: 'Missing alt on Avatar with src', match: match[0] });
        }
      }

      // 3. Fixed widths that might break responsiveness
      let fixedWidthMatches = content.matchAll(/width:\s*['"]?[0-9]+px['"]?/g);
      for (const match of fixedWidthMatches) {
        issues.push({ file: fullPath, type: 'Fixed pixel width found', match: match[0] });
      }

      // 4. Low contrast gray text
      let greyMatches = content.matchAll(/color:\s*['"]?(?:#888|#999|#777|grey\[500\]|text\.secondary)['"]?/g);
      for (const match of greyMatches) {
        // text.secondary is typically fine for AA, but AAA might require text.primary or a darker gray.
        issues.push({ file: fullPath, type: 'Potential low contrast text color', match: match[0] });
      }
      
      // 5. Missing alt on img
      let imgMatches = content.matchAll(/<img[^>]*>/g);
      for (const match of imgMatches) {
        if (!match[0].includes('alt=')) {
          issues.push({ file: fullPath, type: 'Missing alt on img', match: match[0] });
        }
      }
    }
  }
  return issues;
}

const issues = scanDirectory(path.join(__dirname, 'client', 'src'));
console.log(JSON.stringify(issues, null, 2));
