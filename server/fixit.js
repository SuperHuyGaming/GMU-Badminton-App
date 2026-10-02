const fs = require('fs');
['fix_mocks.js', 'fix_stress.js'].forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.split('\\User').join('`User').split('\\);').join('`);');
  fs.writeFileSync(f, c);
});
