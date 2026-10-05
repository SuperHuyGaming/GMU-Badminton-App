const fs = require('fs');
let code = fs.readFileSync('tests/adminTournaments.test.js', 'utf8');

const additionalTests = "
    describe("9. Kafka Consumer Delta Auto-Updating", () => {
        it("gracefully ignores invalid date strings for registrationDeadline without crashing or modifying into Invalid Date", async () => {
            const Tournament = require('../models/Tournament');
            const { handleMessage } = require('../utils/kafkaConsumer');

            const existingTournament = new Tournament({
                tournamentName: "Delta Test Tournament",
                sourceUrl: "https://delta-test.com",
                location: "Test Loc",
                date: new Date("2026-10-10"),
                registrationDeadline: new Date("2026-09-01"),
                status: "active"
            });
            await existingTournament.save();

            const message = {
                value: Buffer.from(JSON.stringify({
                    tournamentName: "Delta Test Tournament",
                    sourceUrl: "https://delta-test.com",
                    confidenceScore: 98,
                    registrationDeadline: "TBD", // Should become undefined
                    location: "Test Loc",
                    date: "2026-10-10",
                    registrationLink: "https://delta-test.com"
                }))
            };

            const result = await handleMessage({
                topic: "tournament-scraping",
                partition: 0,
                message
            });
            
            const updated = await Tournament.findById(existingTournament._id);
            expect(updated.registrationDeadline.getTime()).toBe(existingTournament.registrationDeadline.getTime());
            expect(updated.status).toBe("active");
        });
        
        it("updates existing tournament when new registrationDeadline is provided and valid", async () => {
            const Tournament = require('../models/Tournament');
            const { handleMessage } = require('../utils/kafkaConsumer');

            const existingTournament = new Tournament({
                tournamentName: "Delta Test Update Deadline",
                sourceUrl: "https://delta-test-deadline.com",
                location: "Test Loc",
                date: new Date("2026-10-10"),
                registrationDeadline: new Date("2026-09-01"),
                status: "active"
            });
            await existingTournament.save();

            const newDeadline = new Date("2026-09-15");

            const message = {
                value: Buffer.from(JSON.stringify({
                    tournamentName: "Delta Test Update Deadline",
                    sourceUrl: "https://delta-test-deadline.com",
                    confidenceScore: 98,
                    registrationDeadline: newDeadline.toISOString(),
                    location: "Test Loc",
                    date: "2026-10-10",
                    registrationLink: "https://delta-test-deadline.com"
                }))
            };

            await handleMessage({
                topic: "tournament-scraping",
                partition: 0,
                message
            });
            
            const updated = await Tournament.findById(existingTournament._id);
            expect(updated.registrationDeadline.getTime()).toBe(newDeadline.getTime());
        });

        it("updates existing tournament status to sold_out and closes it", async () => {
            const Tournament = require('../models/Tournament');
            const { handleMessage } = require('../utils/kafkaConsumer');

            const existingTournament = new Tournament({
                tournamentName: "Delta Test Sold Out",
                sourceUrl: "https://delta-test-soldout.com",
                location: "Test Loc",
                date: new Date("2026-10-10"),
                status: "active",
                isOpenTournament: true
            });
            await existingTournament.save();

            const message = {
                value: Buffer.from(JSON.stringify({
                    tournamentName: "Delta Test Sold Out",
                    sourceUrl: "https://delta-test-soldout.com",
                    confidenceScore: 98,
                    status: "sold_out",
                    location: "Test Loc",
                    date: "2026-10-10",
                    registrationLink: "https://delta-test-soldout.com"
                }))
            };

            await handleMessage({
                topic: "tournament-scraping",
                partition: 0,
                message
            });
            
            const updated = await Tournament.findById(existingTournament._id);
            expect(updated.status).toBe("sold_out");
            expect(updated.isOpenTournament).toBe(false);
        });
    });
});
";

code = code.replace(/    \}\);\n\}\);\n*$/, additionalTests);
fs.writeFileSync('tests/adminTournaments.test.js', code);
