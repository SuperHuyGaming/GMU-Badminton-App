const fs=require('fs');
let c=fs.readFileSync('server/models/User.js','utf8');
c = c.replace('name: { type: String, required: true },', 'name: { type: String, required: true },\r\n\tfirstName: { type: String },\r\n\tlastName: { type: String },\r\n\tinternalId: { type: String, unique: true, sparse: true },');
fs.writeFileSync('server/models/User.js',c);
