const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Run eslint to get JSON report
try {
  execSync('npx eslint . --ext js,jsx --format json -o eslint-report.json', { cwd: path.join(__dirname, 'client') });
} catch (e) {
  // eslint exits with 1 if there are errors
}

const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'client', 'eslint-report.json'), 'utf8'));

report.forEach(file => {
  if (file.errorCount === 0 && file.warningCount === 0) return;
  
  let content = fs.readFileSync(file.filePath, 'utf8');
  let lines = content.split('\n');
  let dirty = false;

  // We sort messages by line in descending order so we can delete lines without shifting previous line numbers
  const messages = file.messages.sort((a, b) => b.line - a.line);

  messages.forEach(msg => {
    if (msg.ruleId === 'no-unused-vars') {
      const match = msg.message.match(/'(.*)' is (defined|assigned a value) but never used/);
      if (match) {
        const varName = match[1];
        // If it's an unused import, let's try to remove it
        const lineIdx = msg.line - 1;
        const lineContent = lines[lineIdx];
        
        if (lineContent) {
           if (varName === 'React' && lineContent.includes('import React')) {
             if (lineContent.trim() === "import React from 'react';" || lineContent.trim() === 'import React from "react";') {
                lines.splice(lineIdx, 1);
                dirty = true;
             } else if (lineContent.includes(`import React, {`)) {
                lines[lineIdx] = lineContent.replace(/React,\s*/, '');
                dirty = true;
             }
           } else {
             // For other unused imports, we might just use regex to remove them from the import list
             const importMatch = lineContent.match(new RegExp(`\\b${varName}\\b`));
             if (importMatch && lineContent.includes('import')) {
               // naive removal
               let newContent = lineContent.replace(new RegExp(`\\b${varName}\\b,?`), '').replace(/\{\s*\}/, '');
               if (newContent.trim() === 'import from "react";' || newContent.trim() === "import from 'react';") {
                 lines.splice(lineIdx, 1);
               } else {
                 if (newContent.trim().startsWith('import') && !newContent.includes('{') && !newContent.includes('from')) {
                    // broken import, leave it to manual fix
                 } else {
                    lines[lineIdx] = newContent;
                 }
               }
               dirty = true;
             }
           }
        }
      }
    } else if (msg.ruleId === 'no-useless-escape') {
      const lineIdx = msg.line - 1;
      lines[lineIdx] = lines[lineIdx].replace(/\\-/g, '-');
      dirty = true;
    } else if (msg.ruleId === 'no-unused-directives' || msg.message.includes('Unused eslint-disable directive')) {
      const lineIdx = msg.line - 1;
      lines.splice(lineIdx, 1);
      dirty = true;
    }
  });

  if (dirty) {
    fs.writeFileSync(file.filePath, lines.join('\n'), 'utf8');
  }
});
