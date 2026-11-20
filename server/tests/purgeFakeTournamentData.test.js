/**
 * Tests for scripts/purgeFakeTournamentData.js using small in-memory models,
 * so the real Mongo query shapes ($in with regexes, $or, $nin, dotted paths) are exercised.
 */
const mongoose = require('mongoose');
const {
    FAKE_TOURNAMENT_NAMES,
    buildPurgePlan,
    applyPurgePlan,
    printPlan,
} = require('../scripts/purgeFakeTournamentData');

function getPath(doc, p) {
    return p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), doc);
}

function eq(value, cond) {
    if (cond instanceof RegExp) return typeof value === 'string' && cond.test(value);
    if (cond === null) return value == null;
    return String(value) === String(cond);
}

function matches(doc, query) {
    return Object.entries(query).every(([key, cond]) => {
        if (key === '$or') return cond.some((q) => matches(doc, q));
        const value = getPath(doc, key);
        if (cond && typeof cond === 'object' && !(cond instanceof RegExp) && !(cond instanceof mongoose.Types.ObjectId)) {
            if ('$in' in cond) return cond.$in.some((c) => eq(value, c));
            if ('$nin' in cond) return !cond.$nin.some((c) => eq(value, c));
        }
        return eq(value, cond);
    });
}

function fakeModel(docs) {
    const store = docs.map((d) => ({ _id: new mongoose.Types.ObjectId(), ...d }));
    return {
        store,
        find: jest.fn((q) => ({
            select: () => ({ lean: async () => store.filter((d) => matches(d, q)) }),
        })),
        deleteMany: jest.fn(async (q) => {
            const before = store.length;
            for (let i = store.length - 1; i >= 0; i--) if (matches(store[i], q)) store.splice(i, 1);
            return { deletedCount: before - store.length };
        }),
    };
}

function buildModels() {
    const Tournament = fakeModel([
        { tournamentName: '2026 GMU Badminton Open', sourceUrl: 'https://www.instagram.com/gmu_badminton/', registrations: [{}, {}] },
        { tournamentName: '  2026 snowpeak dc open ', sourceUrl: 'https://umdclubbadminton.com/dc-open' },
        // Real tournament sharing a real source page: must survive and be reported
        { tournamentName: 'GMU Fall Classic 2026', sourceUrl: 'https://www.instagram.com/gmu_badminton/' },
        // Name contains a fake name but is not an exact match: must survive
        { tournamentName: '2026 GMU Badminton Open Qualifier', sourceUrl: 'https://example.org/q' },
    ]);
    const fakeId = Tournament.store[0]._id;
    const realId = Tournament.store[2]._id;

    return {
        fakeId,
        realId,
        models: {
            Tournament,
            TournamentMatch: fakeModel([
                { tournamentId: fakeId, tournamentName: '2026 GMU Badminton Open' },
                { tournamentId: realId, tournamentName: 'GMU Fall Classic 2026' },
                { tournamentId: null, tournamentName: '2026 GMU Badminton Open' },
            ]),
            ProposedTournament: fakeModel([
                { tournamentName: 'GMU Spring Invitational 2027', sourceUrl: 'https://instagram.com/p/gmu_spring_open_2027' },
                { tournamentName: 'Renamed by admin', sourceUrl: 'https://example.org/x', createdTournamentId: fakeId },
                { tournamentName: 'Real proposal', sourceUrl: 'https://novabadmintonacademy.com/' },
            ]),
            DiscoveryQueue: fakeModel([
                { sourceUrl: 'https://umdclubbadminton.com/dc-open', status: 'PENDING_AI_REVIEW' },
                { sourceUrl: 'https://novabadmintonacademy.com/', status: 'PROCESSED' },
            ]),
            Court: fakeModel([
                { name: 'Court 1', currentMatch: { tournamentId: fakeId } },
                { name: 'Court 2', currentMatch: { tournamentId: null } },
            ]),
        },
    };
}

describe('purgeFakeTournamentData', () => {
    test('lists all 8 invented tournament names', () => {
        expect(FAKE_TOURNAMENT_NAMES).toHaveLength(8);
    });

    test('plan targets only exact fake names, invented URLs and their dependents', async () => {
        const { models, fakeId } = buildModels();
        const plan = await buildPurgePlan(models);

        expect(plan.tournaments.map((t) => t.tournamentName.trim().toLowerCase()).sort())
            .toEqual(['2026 gmu badminton open', '2026 snowpeak dc open']);
        expect(plan.matches).toHaveLength(1);
        expect(String(plan.matches[0].tournamentId)).toBe(String(fakeId));
        expect(plan.proposals.map((p) => p.tournamentName).sort())
            .toEqual(['GMU Spring Invitational 2027', 'Renamed by admin']);
        expect(plan.queueItems.map((q) => q.sourceUrl)).toEqual(['https://umdclubbadminton.com/dc-open']);

        // Report-only
        expect(plan.review.tournaments.map((t) => t.tournamentName)).toEqual(['GMU Fall Classic 2026']);
        expect(plan.review.proposals.map((p) => p.tournamentName)).toEqual(['Real proposal']);
        expect(plan.review.queueItems).toHaveLength(1);
        expect(plan.review.unlinkedMatches).toHaveLength(1);
        expect(plan.review.courts.map((c) => c.name)).toEqual(['Court 1']);
    });

    test('building the plan never writes', async () => {
        const { models } = buildModels();
        await buildPurgePlan(models);
        for (const m of Object.values(models)) expect(m.deleteMany).not.toHaveBeenCalled();
    });

    test('apply deletes exactly the planned docs and keeps real data', async () => {
        const { models, realId } = buildModels();
        const plan = await buildPurgePlan(models);
        const deleted = await applyPurgePlan(models, plan);

        expect(deleted).toEqual({ tournaments: 2, matches: 1, proposals: 2, queueItems: 1 });
        expect(models.Tournament.store.map((t) => t.tournamentName).sort())
            .toEqual(['2026 GMU Badminton Open Qualifier', 'GMU Fall Classic 2026']);
        expect(models.TournamentMatch.store.some((m) => String(m.tournamentId) === String(realId))).toBe(true);
        expect(models.ProposedTournament.store.map((p) => p.tournamentName)).toEqual(['Real proposal']);
        expect(models.DiscoveryQueue.store).toHaveLength(1);
        expect(models.Court.store).toHaveLength(2);
    });

    test('a second run finds nothing to delete', async () => {
        const { models } = buildModels();
        await applyPurgePlan(models, await buildPurgePlan(models));
        const plan = await buildPurgePlan(models);
        expect(plan.tournaments.length + plan.matches.length + plan.proposals.length + plan.queueItems.length).toBe(0);
    });

    test('printPlan shows registration counts so real signups are visible before deleting', async () => {
        const { models } = buildModels();
        const lines = [];
        printPlan(await buildPurgePlan(models), (l) => lines.push(l));
        expect(lines.join('\n')).toMatch(/2026 GMU Badminton Open".*registrations=2/);
        expect(lines.join('\n')).toMatch(/For manual review \(NOT deleted\): 5/);
    });
});
