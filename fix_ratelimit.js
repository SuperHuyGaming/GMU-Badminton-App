const fs = require('fs');
let code = fs.readFileSync('server/routes/adminTournaments.js', 'utf8');

const rateLimitCode = \const rateLimit = require('express-rate-limit');
const adminActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { message: "Too many admin actions from this IP, please try again after 15 minutes" }
});
\;

code = code.replace(
  'const router = express.Router();',
  rateLimitCode + '\nconst router = express.Router();'
);

code = code.replace(
  'router.post("/approve/:id", async (req, res) => {',
  'router.post("/approve/:id", adminActionLimiter, async (req, res) => {'
);

code = code.replace(
  'router.post("/reject/:id", async (req, res) => {',
  'router.post("/reject/:id", adminActionLimiter, async (req, res) => {'
);

fs.writeFileSync('server/routes/adminTournaments.js', code, 'utf8');
