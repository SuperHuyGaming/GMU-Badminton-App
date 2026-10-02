
const fs = require("fs");
let file = "routes/matchmaking.js";
let content = fs.readFileSync(file, "utf8");
content = content.replace(/                    \}\r\n                \}\r\n        \]\);/g, "                    }\r\n                } }\r\n        ]);");
content = content.replace(/                        \}\r\n                    \}\r\n            \]\);/g, "                        }\r\n                    } }\r\n            ]);");
fs.writeFileSync(file, content);

