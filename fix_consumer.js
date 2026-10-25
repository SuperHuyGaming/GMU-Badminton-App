const fs = require('fs');
let code = fs.readFileSync('server/utils/kafkaConsumer.js', 'utf8');

const requires = \
const Tournament = require('../models/Tournament');
const redis = require('./redis');
\;

code = code.replace(
  'const ProposedTournament = require(\"../models/ProposedTournament\");',
  'const ProposedTournament = require(\"../models/ProposedTournament\");' + requires
);

const autoPublishLogic = \
        let savedDoc;
        const now = new Date();
        const hasMandatoryFields = parsedDoc.tournamentName && parsedDoc.date && parsedDoc.location && parsedDoc.registrationLink;
        const isFutureDate = parsedDoc.date && new Date(parsedDoc.date) > now;

        if (parsedDoc.confidenceScore >= 95 && hasMandatoryFields && isFutureDate) {
            console.log(\\\[Kafka Consumer][\\\$\{topic\} p:\\\$\{partition\}]: High confidence (\\\$\{parsedDoc.confidenceScore\}%). Auto-publishing "\\\$\{parsedDoc.tournamentName\}"\\\);
            
            const tournament = new Tournament({
                tournamentName: parsedDoc.tournamentName,
                eventLocation: parsedDoc.location,
                hostUniversity: "Local Club", // Or extracted
                startDate: parsedDoc.date,
                endDate: parsedDoc.date,
                registrationDeadline: parsedDoc.registrationDeadline,
                registrationUrl: parsedDoc.registrationLink,
                sourceUrl: parsedDoc.sourceUrl,
                flyerImageUrl: parsedDoc.scrapedImageUrls && parsedDoc.scrapedImageUrls.length > 0 ? parsedDoc.scrapedImageUrls[0] : "",
                skillLevels: parsedDoc.skillLevels,
                originalCaption: parsedDoc.rawCaption,
                isOpenTournament: true,
                rsvpCount: 0
            });
            savedDoc = await tournament.save();

            // Invalidate cache
            const keys = await redis.keys('tournaments:*');
            if (keys.length > 0) await redis.del(keys);
        } else {
            console.log(\\\[Kafka Consumer][\\\$\{topic\} p:\\\$\{partition\}]: Ingesting proposal "\\\$\{parsedDoc.tournamentName\}" for Admin review\\\);
            const proposal = new ProposedTournament(parsedDoc);
            savedDoc = await proposal.save();
        }
        return savedDoc;
\;

code = code.replace(
    /console\.log\(\\[Kafka Consumer\]\[\$\{topic\} p:\$\{partition\}\]: Ingesting proposal.*?return savedDoc;/s,
    autoPublishLogic.trim()
);

fs.writeFileSync('server/utils/kafkaConsumer.js', code, 'utf8');
