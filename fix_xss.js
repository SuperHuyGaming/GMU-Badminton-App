const fs = require('fs');
let code = fs.readFileSync('server/utils/kafkaConsumer.js', 'utf8');

const xssRequire = \const xss = require('xss');\;

code = code.replace(
  'const promClient = require(\'prom-client\');',
  'const promClient = require(\'prom-client\');\n' + xssRequire
);

// We'll replace the new ProposedTournament instantiation block
const replacement = \
        const proposal = new ProposedTournament({
            rawCaption: xss(rawCaption),
            scrapedImageUrls: scrapedImageUrls.map(u => xss(u)),
            sourceLinks: Array.isArray(data.sourceLinks) ? data.sourceLinks.map(l => xss(l)) : [],
            tournamentName: xss(tournamentName),
            date: data.date || aiData.date ? new Date(data.date || aiData.date) : undefined,
            location: xss((data.location || aiData.location || "TBD").trim()),
            entryFee: xss((data.entryFee || aiData.entryFee || "").trim()),
            registrationLink: xss((data.registrationLink || aiData.registrationLink || "").trim()),
            skillLevels: Array.isArray(data.skillLevels) ? data.skillLevels.map(s => xss(s)) : (Array.isArray(aiData.skillLevels) ? aiData.skillLevels.map(s => xss(s)) : []),
            registrationDeadline: data.registrationDeadline || aiData.registrationDeadline ? new Date(data.registrationDeadline || aiData.registrationDeadline) : undefined,
            sourceUrl: xss(sourceUrl),
            confidenceScore: Number(data.confidenceScore) || Number(aiData.confidenceScore) || 85,
            status: "pending"
        });
\;

code = code.replace(
  /const proposal = new ProposedTournament\(\{[\s\S]*?status: \"pending\"\n\s*\}\);/,
  replacement.trim()
);

fs.writeFileSync('server/utils/kafkaConsumer.js', code, 'utf8');
