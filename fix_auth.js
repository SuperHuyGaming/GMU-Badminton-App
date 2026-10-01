@
const fs=require("fs");
let c=fs.readFileSync("server/routes/auth.js","utf8");
c = c.replace(
    "const { name, email, password } = req.body;",
    "const { firstName, lastName, email, password } = req.body;"
);
c = c.replace(
    "user = new User({\r\n\t\t\tname,\r\n\t\t\temail,\r\n\t\t\tpassword: hashedPassword,\r\n\t\t});",
    "const name = firstName && lastName ? `${firstName} ${lastName}` : (req.body.name || `Unknown`);\r\n\t\tconst internalId = `UID-${Math.floor(10000 + Math.random() * 90000)}`;\r\n\r\n\t\tuser = new User({\r\n\t\t\tname,\r\n\t\t\tfirstName,\r\n\t\t\tlastName,\r\n\t\t\tinternalId,\r\n\t\t\temail,\r\n\t\t\tpassword: hashedPassword,\r\n\t\t});"
);
c = c.replace(
    /user: \{\s*id: user._id,\s*name: user.name,\s*email: user.email,/g,
    "user: {\r\n\t\t\t\tid: user._id,\r\n\t\t\t\tname: user.name,\r\n\t\t\t\tfirstName: user.firstName,\r\n\t\t\t\tlastName: user.lastName,\r\n\t\t\t\tinternalId: user.internalId,\r\n\t\t\t\temail: user.email,"
);
fs.writeFileSync("server/routes/auth.js",c);
@
