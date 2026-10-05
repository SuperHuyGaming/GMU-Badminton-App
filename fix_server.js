const fs = require('fs');
let code = fs.readFileSync('server/server.js', 'utf8');

// Require
code = code.replace(
  'const express = require(\"express\");',
  'const express = require(\"express\");\nconst promBundle = require(\"express-prom-bundle\");'
);

// Add middleware
code = code.replace(
  'const app = express();',
  'const app = express();\n\nconst metricsMiddleware = promBundle({includeMethod: true});\napp.use(metricsMiddleware);\n'
);

fs.writeFileSync('server/server.js', code, 'utf8');
