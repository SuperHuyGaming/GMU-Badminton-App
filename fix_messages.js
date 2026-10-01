const fs = require('fs');
let file = 'client/src/pages/Messages.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'import { Link as RouterLink } from "react-router-dom";',
    'import { Link as RouterLink, useLocation } from "react-router-dom";'
);

content = content.replace(
    'const { user } = useAuth();',
    'const { user } = useAuth();\n\tconst location = useLocation();'
);

fs.writeFileSync(file, content);
