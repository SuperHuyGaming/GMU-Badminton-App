const fs = require('fs');
const path = require('path');

function fixDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      fixDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;

      // 1. Add aria-label to IconButton
      content = content.replace(/<IconButton(?!\s+[^>]*aria-label)[^>]*>/g, (match) => {
        return match.replace('<IconButton', '<IconButton aria-label="icon button"');
      });

      // 2. Add alt to Avatar
      content = content.replace(/<Avatar(?!\s+[^>]*alt)[^>]*src=[^>]*>/g, (match) => {
        // Find where to insert alt="Avatar"
        if (match.endsWith('/>')) {
          return match.slice(0, -2) + ' alt="User Avatar" />';
        } else {
          return match.slice(0, -1) + ' alt="User Avatar" >';
        }
      });
      
      // Add alt to Avatar even if src is multi-line
      // Actually, regex across newlines is tricky in JS without `s` flag or complex regex.
      // Let's use `[\s\S]` for Avatar
      content = content.replace(/<Avatar(?![^>]*alt=)[^>]*src=[^>]*>/g, (match) => {
        if (match.endsWith('/>')) {
          return match.slice(0, -2) + ' alt="User Avatar" />';
        } else {
          return match.slice(0, -1) + ' alt="User Avatar" >';
        }
      });

      // 3. Add alt to img
      content = content.replace(/<img(?![^>]*alt=)[^>]*src=[^>]*>/g, (match) => {
        if (match.endsWith('/>')) {
          return match.slice(0, -2) + ' alt="Image" />';
        } else {
          return match.slice(0, -1) + ' alt="Image" >';
        }
      });

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed A11y in ${fullPath}`);
      }
    }
  }
}

fixDirectory(path.join(__dirname, 'client', 'src'));

// Also fix App.jsx theme colors
const appJsxPath = path.join(__dirname, 'client', 'src', 'App.jsx');
let appContent = fs.readFileSync(appJsxPath, 'utf8');
if (appContent.includes('palette: {') && !appContent.includes('text: {')) {
  appContent = appContent.replace(
    /background:\s*\{\s*default:\s*mode\s*===\s*"light"\s*\?\s*"#f4f6f8"\s*:\s*"#02120a",\s*paper:\s*mode\s*===\s*"light"\s*\?\s*"rgba\(255, 255, 255, 0.75\)"\s*:\s*"rgba\(8, 33, 20, 0.75\)",\s*\},/g,
    `background: { 
  				default: mode === "light" ? "#f4f6f8" : "#02120a", // Ultra deep forest green
  				paper: mode === "light" ? "rgba(255, 255, 255, 0.75)" : "rgba(8, 33, 20, 0.75)", // Translucent for glassmorphism
  			},
  			text: {
  				primary: mode === "light" ? "#0f172a" : "#f8fafc",
  				secondary: mode === "light" ? "#334155" : "#cbd5e1"
  			},`
  );
  fs.writeFileSync(appJsxPath, appContent, 'utf8');
  console.log('Fixed App.jsx theme colors');
}

