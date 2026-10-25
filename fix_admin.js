const fs = require('fs');
let code = fs.readFileSync('server/routes/adminTournaments.js', 'utf8');

// Add redis require
code = code.replace(
    'const adminMiddleware = require(\"../middleware/admin\");',
    'const adminMiddleware = require(\"../middleware/admin\");\nconst redis = require(\"../utils/redis\");'
);

// Add invalidation in approve route
code = code.replace(
    'await newTournament.save();',
    'await newTournament.save();\n\n        // Invalidate public tournaments cache\n        const keys = await redis.keys(\"tournaments:*\");\n        if (keys.length > 0) await redis.del(keys);'
);

fs.writeFileSync('server/routes/adminTournaments.js', code, 'utf8');
