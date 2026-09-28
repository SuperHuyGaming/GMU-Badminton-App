const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('client/src', (filePath) => {
    if (!filePath.endsWith('.jsx') && !filePath.endsWith('.tsx')) return;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Find <img ...> without alt
    let imgRegex = /<img\s+([^>]*?)>/g;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
        if (!/alt\s*=/.test(match[1])) {
            console.log(`Missing alt in ${filePath} at index ${match.index}`);
        }
    }
    
    // Find <IconButton ...> without aria-label
    let iconBtnRegex = /<IconButton\s+([^>]*?)>/g;
    while ((match = iconBtnRegex.exec(content)) !== null) {
        if (!/aria-label\s*=/.test(match[1])) {
            console.log(`Missing aria-label in ${filePath} at index ${match.index}`);
        }
    }
});
