const fs = require('fs');
const path = require('path');

function fixAvatars(dir) {
    fs.readdirSync(dir).forEach(f => {
        let p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            fixAvatars(p);
        } else if (p.endsWith('.jsx') || p.endsWith('.tsx')) {
            let content = fs.readFileSync(p, 'utf-8');
            let updated = false;
            
            // Find <Avatar ... >
            let regex = /<Avatar\s+([^>]*?)>/g;
            content = content.replace(regex, (match, attrs) => {
                // If it has src but no alt
                if (attrs.includes('src=') && !attrs.includes('alt=')) {
                    updated = true;
                    // Add alt="" just before the closing >
                    // Wait, what if it's self closing <Avatar ... />?
                    if (match.endsWith('/>')) {
                        return match.slice(0, -2) + ' alt="" />';
                    } else {
                        return match.slice(0, -1) + ' alt="">';
                    }
                }
                return match;
            });
            
            if (updated) {
                fs.writeFileSync(p, content, 'utf-8');
                console.log('Fixed Avatars in', p);
            }
        }
    });
}

fixAvatars('client/src');
