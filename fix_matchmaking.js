
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "server/routes/matchmaking.js");
let content = fs.readFileSync(file, "utf-8");

content = content.replace(
`        // Add search filtering if provided
        if (search) {
            const sanitizedSearch = escapeRegex(search);
            if (sanitizedSearch) {
                query.$or = [
                    { name: { $regex: sanitizedSearch, $options: "i" } },
                    { homeUniversity: { $regex: sanitizedSearch, $options: "i" } }
                ];
            }
        }`,
`        // Add search filtering if provided
        if (search) {
            const sanitizedSearch = escapeRegex(search);
            if (sanitizedSearch) {
                if (query.$or) {
                    query.$and = [
                        { $or: query.$or },
                        { $or: [
                            { name: { $regex: sanitizedSearch, $options: "i" } },
                            { homeUniversity: { $regex: sanitizedSearch, $options: "i" } }
                        ]}
                    ];
                    delete query.$or;
                } else {
                    query.$or = [
                        { name: { $regex: sanitizedSearch, $options: "i" } },
                        { homeUniversity: { $regex: sanitizedSearch, $options: "i" } }
                    ];
                }
            }
        }`
);

fs.writeFileSync(file, content);
console.log("Fixed matchmaking.js OR clause");

