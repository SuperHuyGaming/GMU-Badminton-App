const fs = require('fs');
let code = fs.readFileSync('server/routes/adminTournaments.js', 'utf8');
code = code.replace(
    /await tournament\.save\(\);\s+proposed\.status = "approved";/,
    'await tournament.save();\n\n        // Invalidate public tournaments cache\n        const keys = await redis.keys("tournaments:*");\n        if (keys.length > 0) await redis.del(keys);\n\n        proposed.status = "approved";'
);
fs.writeFileSync('server/routes/adminTournaments.js', code, 'utf8');
