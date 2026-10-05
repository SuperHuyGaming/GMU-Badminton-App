const fs = require('fs');
let code = fs.readFileSync('server/routes/adminTournaments.js', 'utf8');

code = code.replace(
  'router.post("/approve/:id", async (req, res) => {',
  'router.post("/approve/:id", adminActionLimiter, async (req, res) => {'
);

code = code.replace(
  'router.post("/reject/:id", async (req, res) => {',
  'router.post("/reject/:id", adminActionLimiter, async (req, res) => {'
);

code = code.replace(
    'await tournament.save();\n\n        proposed.status = "approved";',
    'await tournament.save();\n\n        // Invalidate public tournaments cache\n        const keys = await redis.keys("tournaments:*");\n        if (keys.length > 0) await redis.del(keys);\n\n        proposed.status = "approved";'
);

fs.writeFileSync('server/routes/adminTournaments.js', code, 'utf8');
