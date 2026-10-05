const fs = require('fs');
let code = fs.readFileSync('server/utils/kafkaConsumer.js', 'utf8');

if (!code.includes('pushNotifications')) {
    code = code.replace(
        'const redis = require(\\'./redis\\');',
        'const redis = require(\\'./redis\\');\\nconst { sendPushToAllUsers } = require(\\'./pushNotifications\\');'
    );
}

const replacement = \
                if (parsedDoc.registrationDeadline && 
                    existingTournament.registrationDeadline && 
                    parsedDoc.registrationDeadline.getTime() !== existingTournament.registrationDeadline.getTime()) {
                    console.log(\\\[Kafka Consumer] Auto-Updating Deadline: \\\$\{existingTournament.registrationDeadline\} -> \\\$\{parsedDoc.registrationDeadline\}\\\);
                    existingTournament.registrationDeadline = parsedDoc.registrationDeadline;
                    hasChanges = true;
                    await sendPushToAllUsers(
                        "dYs" Tournament Update!",
                        \\\The registration deadline for \\\$\{existingTournament.tournamentName\} has been updated to \\\$\{new Date(parsedDoc.registrationDeadline).toLocaleDateString()\}.\\\,
                        "/tournaments"
                    );
                }

                if (parsedDoc.eventStatus && existingTournament.status !== parsedDoc.eventStatus) {
                    console.log(\\\[Kafka Consumer] Auto-Updating Status: \\\$\{existingTournament.status\} -> \\\$\{parsedDoc.eventStatus\}\\\);
                    existingTournament.status = parsedDoc.eventStatus;
                    
                    if (parsedDoc.eventStatus === "sold_out") {
                        existingTournament.isOpenTournament = false;
                        await sendPushToAllUsers(
                            "dY" Tournament Update",
                            \\\Registration for \\\$\{existingTournament.tournamentName\} is now fully booked!\\\,
                            "/tournaments"
                        );
                    } else if (parsedDoc.eventStatus === "canceled") {
                        existingTournament.isOpenTournament = false;
                        await sendPushToAllUsers(
                            "dY" Tournament Canceled",
                            \\\Unfortunately, \\\$\{existingTournament.tournamentName\} has been canceled.\\\,
                            "/tournaments"
                        );
                    }
                    hasChanges = true;
                }
\;

code = code.replace(
    /if \(parsedDoc\.registrationDeadline &&[\s\S]*?hasChanges = true;\n                \}/,
    replacement.trim()
);

fs.writeFileSync('server/utils/kafkaConsumer.js', code, 'utf8');
