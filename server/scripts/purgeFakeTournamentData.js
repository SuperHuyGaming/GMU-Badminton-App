#!/usr/bin/env node
/**
 * server/scripts/purgeFakeTournamentData.js
 *
 * Removes the invented tournaments that the old hunter seeding
 * (getGuaranteedTournamentsList, removed in #209) and
 * scripts/seedProposedTournaments.js wrote to MongoDB, plus the records that
 * only exist because of them.
 *
 * Runs as a DRY RUN by default and only prints what it would do.
 * Nothing is written unless --apply is passed.
 *
 * Usage (from the server folder, MONGO_URI or MONGODB_URI pointing at the target DB):
 *   node scripts/purgeFakeTournamentData.js           # dry run
 *   node scripts/purgeFakeTournamentData.js --apply   # delete
 *
 * What it deletes:
 *   - Tournament docs whose name exactly matches FAKE_TOURNAMENT_NAMES
 *   - TournamentMatch docs whose tournamentId points at one of those tournaments
 *   - ProposedTournament docs with a fake name, an invented source URL,
 *     or createdTournamentId pointing at a deleted tournament
 *   - DiscoveryQueue entries for the invented source URLs
 *
 * What it only reports (for manual review, never deleted):
 *   - Records that use a real page as their source (SHARED_SOURCE_URLS):
 *     a real tournament may legitimately come from the same page
 *   - TournamentMatch docs with no tournamentId but a fake tournamentName
 *     (the schema defaults tournamentName to "2026 GMU Badminton Open")
 *   - Courts whose currentMatch points at a deleted tournament
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

// Invented tournaments: none of these were confirmed real events.
const FAKE_TOURNAMENT_NAMES = [
    // Hardcoded seeds from the old hunter (removed in #209)
    '2026 GMU Badminton Open',
    '2026 Mid-Atlantic Collegiate Championships',
    '2026 Snowpeak DC Open',
    '2026 NVBC Spring Open',
    '2027 GMU Winter Collegiate Invitational',
    // Sample proposals from scripts/seedProposedTournaments.js
    'GMU Spring Invitational 2027',
    'UMD Terrapin Badminton Classic 2027',
    'Capital Badminton Open Cup 2027',
];

// Source URLs that were made up, so anything using them is fake.
const FAKE_SOURCE_URLS = [
    'https://umdclubbadminton.com/dc-open',
    'https://instagram.com/p/gmu_spring_open_2027',
    'https://instagram.com/p/umd_terp_classic_2027',
    'https://instagram.com/p/capital_badminton_cup_2027',
];

// Real pages the fakes pointed at. Report only.
const SHARED_SOURCE_URLS = [
    'https://www.instagram.com/gmu_badminton/',
    'https://www.tournamentsoftware.com/tournament/29B5BFFA-ED41-49F5-8294-1E1F54A8D8A5',
    'https://novabadmintonacademy.com/',
];

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Exact name match, ignoring case and surrounding whitespace.
function nameMatchers(names = FAKE_TOURNAMENT_NAMES) {
    return names.map((n) => new RegExp(`^\\s*${escapeRegex(n)}\\s*$`, 'i'));
}

function maskUri(uri) {
    return String(uri).replace(/\/\/([^@/]+)@/, '//****@');
}

function loadModels() {
    return {
        Tournament: require('../models/Tournament'),
        TournamentMatch: require('../models/TournamentMatch'),
        ProposedTournament: require('../models/ProposedTournament'),
        DiscoveryQueue: require('../models/DiscoveryQueue'),
        Court: require('../models/Court'),
    };
}

/**
 * Finds everything to delete or review. Read-only.
 * @param {object} models Tournament, TournamentMatch, ProposedTournament, DiscoveryQueue, Court
 */
async function buildPurgePlan(models) {
    const { Tournament, TournamentMatch, ProposedTournament, DiscoveryQueue, Court } = models;
    const names = nameMatchers();

    const tournaments = await Tournament.find({ tournamentName: { $in: names } })
        .select('_id tournamentName startDate status sourceUrl registrations attendees')
        .lean();
    const tournamentIds = tournaments.map((t) => t._id);

    const matches = tournamentIds.length
        ? await TournamentMatch.find({ tournamentId: { $in: tournamentIds } }).select('_id tournamentId').lean()
        : [];

    const proposals = await ProposedTournament.find({
        $or: [
            { tournamentName: { $in: names } },
            { sourceUrl: { $in: FAKE_SOURCE_URLS } },
            ...(tournamentIds.length ? [{ createdTournamentId: { $in: tournamentIds } }] : []),
        ],
    }).select('_id tournamentName sourceUrl status').lean();

    const queueItems = await DiscoveryQueue.find({ sourceUrl: { $in: FAKE_SOURCE_URLS } })
        .select('_id sourceUrl status')
        .lean();

    // Report-only lookups
    const review = {
        tournaments: await Tournament.find({
            sourceUrl: { $in: SHARED_SOURCE_URLS },
            tournamentName: { $nin: names },
        }).select('_id tournamentName sourceUrl startDate').lean(),
        proposals: await ProposedTournament.find({
            sourceUrl: { $in: SHARED_SOURCE_URLS },
            tournamentName: { $nin: names },
        }).select('_id tournamentName sourceUrl status').lean(),
        queueItems: await DiscoveryQueue.find({ sourceUrl: { $in: SHARED_SOURCE_URLS } })
            .select('_id sourceUrl status').lean(),
        unlinkedMatches: await TournamentMatch.find({
            tournamentId: null,
            tournamentName: { $in: names },
        }).select('_id tournamentName').lean(),
        courts: tournamentIds.length
            ? await Court.find({ 'currentMatch.tournamentId': { $in: tournamentIds } }).select('_id name').lean()
            : [],
    };

    return { tournaments, matches, proposals, queueItems, review };
}

/** Deletes exactly the ids in the plan. */
async function applyPurgePlan(models, plan) {
    const ids = (docs) => docs.map((d) => d._id);
    const del = async (Model, docs) => (docs.length ? (await Model.deleteMany({ _id: { $in: ids(docs) } })).deletedCount : 0);

    return {
        tournaments: await del(models.Tournament, plan.tournaments),
        matches: await del(models.TournamentMatch, plan.matches),
        proposals: await del(models.ProposedTournament, plan.proposals),
        queueItems: await del(models.DiscoveryQueue, plan.queueItems),
    };
}

function printPlan(plan, log = console.log) {
    const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'no date');

    log(`\nTournaments to delete: ${plan.tournaments.length}`);
    for (const t of plan.tournaments) {
        const regs = Array.isArray(t.registrations) ? t.registrations.length : 0;
        const att = Array.isArray(t.attendees) ? t.attendees.length : 0;
        log(`  - ${t._id}  "${t.tournamentName}"  ${fmtDate(t.startDate)}  status=${t.status}  registrations=${regs}  attendees=${att}`);
    }
    log(`TournamentMatch docs to delete: ${plan.matches.length}`);
    log(`ProposedTournament docs to delete: ${plan.proposals.length}`);
    for (const p of plan.proposals) log(`  - ${p._id}  "${p.tournamentName}"  ${p.status}  ${p.sourceUrl}`);
    log(`DiscoveryQueue entries to delete: ${plan.queueItems.length}`);
    for (const q of plan.queueItems) log(`  - ${q._id}  ${q.status}  ${q.sourceUrl}`);

    const r = plan.review;
    const reviewCount = r.tournaments.length + r.proposals.length + r.queueItems.length + r.unlinkedMatches.length + r.courts.length;
    log(`\nFor manual review (NOT deleted): ${reviewCount}`);
    for (const t of r.tournaments) log(`  - Tournament ${t._id}  "${t.tournamentName}"  ${fmtDate(t.startDate)}  ${t.sourceUrl}`);
    for (const p of r.proposals) log(`  - Proposal ${p._id}  "${p.tournamentName}"  ${p.status}  ${p.sourceUrl}`);
    for (const q of r.queueItems) log(`  - Queue ${q._id}  ${q.status}  ${q.sourceUrl}`);
    for (const m of r.unlinkedMatches) log(`  - TournamentMatch ${m._id} with no tournamentId, name "${m.tournamentName}"`);
    for (const c of r.courts) log(`  - Court ${c._id} "${c.name}" has currentMatch on a deleted tournament`);
}

async function main(argv = process.argv) {
    const apply = argv.includes('--apply');
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGO_URI (or MONGODB_URI) is not set. Refusing to guess a database.');
        return 1;
    }

    console.log(`Fake tournament purge ${apply ? '[APPLY: deleting]' : '[DRY RUN: pass --apply to delete]'}`);
    console.log(`Target: ${maskUri(mongoUri)}`);

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
        console.log(`Connected. Database: ${mongoose.connection.name}`);

        const models = loadModels();
        const plan = await buildPurgePlan(models);
        printPlan(plan);

        if (!apply) {
            console.log('\nDry run only. Nothing was changed.');
            return 0;
        }

        const deleted = await applyPurgePlan(models, plan);
        console.log('\nDeleted:', deleted);
        return 0;
    } catch (err) {
        console.error(`Purge failed: ${err.message}`);
        return 1;
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

if (require.main === module) {
    main().then((code) => process.exit(code));
}

module.exports = {
    FAKE_TOURNAMENT_NAMES,
    FAKE_SOURCE_URLS,
    SHARED_SOURCE_URLS,
    nameMatchers,
    buildPurgePlan,
    applyPurgePlan,
    printPlan,
    main,
};
