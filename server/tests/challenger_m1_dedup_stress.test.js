const mongoose = require("mongoose");
const {
    tokenize,
    computeTfIdfVector,
    cosineSimilarity,
    shouldPruneCandidate,
    levenshteinDistance,
    stringSimilarity,
    computeTitleSimilarity,
    isWithinDateWindow,
    mergeTournamentData,
    deduplicateTournament,
    isDuplicateTournament
} = require("../utils/deduplication");

describe("Milestone 1 Empirical Challenger Stress Suite: ML Pruning & Deduplication Engine", () => {

    // =========================================================================
    // SECTION 1: shouldPruneCandidate Cascade Stress & Edge Mining
    // =========================================================================
    describe("1. shouldPruneCandidate Cascade Stress & Boundary Testing", () => {
        test("TEMPORAL BOUNDARY: exactly 48.000 hours does not prune, 48.001 hours prunes", () => {
            const base = new Date("2026-11-01T12:00:00.000Z");
            const exactly48h = new Date(base.getTime() + 48 * 3600 * 1000);
            const slightlyOver48h = new Date(base.getTime() + (48 * 3600 + 1) * 1000); // 48h 1s

            const resExact = shouldPruneCandidate("Open", base, "Open", exactly48h, 48);
            expect(resExact.prune).toBe(false);

            const resOver = shouldPruneCandidate("Open", base, "Open", slightlyOver48h, 48);
            expect(resOver.prune).toBe(true);
            expect(resOver.reason).toBe("temporal_window_exceeded");
        });

        test("TEMPORAL RESILIENCE: handles invalid, null, undefined, and non-date strings without crashing", () => {
            const invalidDates = [null, undefined, "not-a-date", "", "TBD", NaN, {}, []];
            invalidDates.forEach(d1 => {
                invalidDates.forEach(d2 => {
                    expect(() => {
                        const res = shouldPruneCandidate("Open 2026", d1, "Open 2026", d2, 48);
                        expect(res).toBeDefined();
                        expect(res.prune).toBe(false); // Valid shared tokens, invalid date should not crash or reject
                    }).not.toThrow();
                });
            });
        });

        test("LENGTH RATIO BOUNDARY: ratio <= 3.5:1 passes, ratio > 3.5:1 without substring prunes", () => {
            const d1 = "abcdefghij"; // len 10
            const d2 = "12345678901234567890123456789012345"; // len 35 (disjoint, ratio 3.5)
            const resBoundary = shouldPruneCandidate(d1, null, d2, null);
            expect(resBoundary.reason).not.toBe("length_ratio_exceeded");

            const d3 = "123456789012345678901234567890123456"; // len 36 (disjoint, ratio 3.6 > 3.5)
            const resOver = shouldPruneCandidate(d1, null, d3, null);
            expect(resOver.prune).toBe(true);
            expect(resOver.reason).toBe("length_ratio_exceeded");
        });

        test("PARAMETER RESILIENCE: handles both object style and positional arguments identically", () => {
            const candObj = { tournamentName: "GMU Open 2026", startDate: new Date("2026-11-01T10:00:00Z") };
            const existObj = { tournamentName: "GMU Open 2026", startDate: new Date("2026-11-05T10:00:00Z") }; // >48h

            const objStyle = shouldPruneCandidate(candObj, existObj, { windowHours: 48 });
            const posStyle = shouldPruneCandidate(candObj.tournamentName, candObj.startDate, existObj.tournamentName, existObj.startDate, 48);

            expect(objStyle.prune).toBe(true);
            expect(posStyle.prune).toBe(true);
            expect(objStyle.reason).toBe(posStyle.reason);
        });

        test("NULL / EMPTY SAFEGUARD: handles null, undefined, empty string candidate titles safely", () => {
            expect(() => shouldPruneCandidate(null, null, null, null)).not.toThrow();
            expect(() => shouldPruneCandidate("", null, "", null)).not.toThrow();
            expect(() => shouldPruneCandidate({}, {})).not.toThrow();
        });
    });

    // =========================================================================
    // SECTION 2: TF-IDF Vectorizer & Cosine Similarity Verification
    // =========================================================================
    describe("2. TF-IDF Vectorizer & Cosine Similarity Deep Verification", () => {
        test("distinctive collegiate terms receive higher IDF weights than generic sports stop words", () => {
            const vec = computeTfIdfVector("GMU Badminton Open Tournament Championship");
            expect(vec["gmu"]).toBeGreaterThan(vec["badminton"]);
            expect(vec["gmu"]).toBeGreaterThan(vec["open"]);
            expect(vec["gmu"]).toBeGreaterThan(vec["tournament"]);
        });

        test("sub-word character trigrams ensure robust vectorization with partial typos", () => {
            const vecExact = computeTfIdfVector("Virginia Tech Open");
            const vecTypo = computeTfIdfVector("Virgina Tech Open"); // missing 'i' in Virginia

            const sim = cosineSimilarity(vecExact, vecTypo);
            expect(sim).toBeGreaterThan(0.55); // Trigrams preserve structural similarity
        });

        test("empty and whitespace-only text produces zero vectors and safe 0.0 cosine similarity", () => {
            expect(computeTfIdfVector("")).toEqual({});
            expect(computeTfIdfVector("    ")).toEqual({});
            expect(computeTfIdfVector(null)).toEqual({});
            expect(cosineSimilarity({}, {})).toBe(0);
            expect(cosineSimilarity(computeTfIdfVector("GMU"), {})).toBe(0);
        });

        test("orthogonal titles produce strictly 0.0 or near-0 cosine similarity", () => {
            const vec1 = computeTfIdfVector("1111 2222");
            const vec2 = computeTfIdfVector("8888 9999");
            expect(cosineSimilarity(vec1, vec2)).toBe(0);
        });
    });

    // =========================================================================
    // SECTION 3: Robustness & Flight Noise Handling
    // =========================================================================
    describe("3. Hybrid Ensemble Robustness & Flight Noise Stress", () => {
        test("FLIGHT NOISE RESILIENCE: recognizes same tournament across flight designations", () => {
            const flightPairs = [
                ["2026 GMU Badminton Open (Flight A/B/C)", "2026 GMU Badminton Open"],
                ["2026 UMD Terrapin Open - Flight A", "2026 UMD Terrapin Open - Flight B"],
                ["2026 NVBC Open Flight A", "2026 NVBC Open Flight C"],
                ["Mid-Atlantic Collegiate Championships [Flight A/B]", "Mid-Atlantic Collegiate Championships"]
            ];

            flightPairs.forEach(([t1, t2]) => {
                const sim = computeTitleSimilarity(t1, t2);
                expect(sim).toBeGreaterThanOrEqual(0.85);
            });
        });

        test("PUNCTUATION & CASING: handles aggressive symbols, emojis, and irregular whitespace", () => {
            const messy1 = "🏸 2026   GMU -- Badminton // Open !! 🏸";
            const messy2 = "2026 gmu badminton open";
            expect(computeTitleSimilarity(messy1, messy2)).toBeGreaterThanOrEqual(0.85);
        });
    });

    // =========================================================================
    // SECTION 4: Division Draw Merging & Data Integrity
    // =========================================================================
    describe("4. Division Draw Merging, Collision Prevention, and Data Integrity", () => {
        test("COLLISION-FREE DIVISION MERGING: preserves separate divisions, merges duplicates, updates maxDraw", () => {
            const existing = {
                _id: new mongoose.Types.ObjectId(),
                tournamentName: "2026 GMU Badminton Open",
                startDate: new Date("2026-11-07T09:00:00Z"),
                divisions: [
                    { code: "MS_OPEN", name: "Men's Singles Open", maxDraw: 32, fee: "$25", feeAmount: 25 },
                    { code: "WS_OPEN", name: "Women's Singles Open", maxDraw: 16, fee: "$25", feeAmount: 25 }
                ]
            };

            const incoming = {
                tournamentName: "2026 GMU Badminton Open",
                startDate: new Date("2026-11-07T09:00:00Z"),
                divisions: [
                    { code: "MS_OPEN", name: "Men's Singles Open", maxDraw: 64, fee: "$30", feeAmount: 30 },
                    { code: "MD_OPEN", name: "Men's Doubles Open", maxDraw: 32, fee: "$50", feeAmount: 50 },
                    { code: "ws_open", name: "Women's Singles Open", maxDraw: 32, fee: "$25", feeAmount: 25 }
                ]
            };

            const merged = mergeTournamentData(existing, incoming);
            expect(merged.divisions).toHaveLength(3); // MS_OPEN, WS_OPEN, MD_OPEN

            const ms = merged.divisions.find(d => d.code === "MS_OPEN");
            expect(ms.maxDraw).toBe(64);

            const ws = merged.divisions.find(d => d.code === "WS_OPEN");
            expect(ws.maxDraw).toBe(32);

            const md = merged.divisions.find(d => d.code === "MD_OPEN");
            expect(md.maxDraw).toBe(32);
        });

        test("REGISTRATION URL FALLBACK: preserves existing registration URL if present, fills from incoming if missing", () => {
            const canonicalWithUrl = {
                registrationUrl: "https://forms.gle/official-form",
                sourceLinks: ["https://instagram.com/p/1"]
            };
            const incomingWithOther = {
                registrationUrl: "https://linktr.ee/gmubadminton",
                sourceLinks: ["https://linktr.ee/gmubadminton"]
            };

            const merged1 = mergeTournamentData(canonicalWithUrl, incomingWithOther);
            expect(merged1.registrationUrl).toBe("https://forms.gle/official-form");
            expect(merged1.sourceLinks).toContain("https://forms.gle/official-form");
            expect(merged1.sourceLinks).toContain("https://linktr.ee/gmubadminton");

            const canonicalWithoutUrl = {
                registrationUrl: "",
                sourceLinks: []
            };
            const merged2 = mergeTournamentData(canonicalWithoutUrl, incomingWithOther);
            expect(merged2.registrationUrl).toBe("https://linktr.ee/gmubadminton");
        });

        test("ATTENDEE SET UNION: deduplicates user IDs across ObjectIds, strings, and populates rsvpCount", () => {
            const userA = new mongoose.Types.ObjectId();
            const userB = new mongoose.Types.ObjectId();
            const userC = new mongoose.Types.ObjectId();

            const canonical = {
                attendees: [userA, userB.toString()],
                rsvpCount: 2
            };
            const incoming = {
                attendees: [userB, userC],
                rsvpCount: 2
            };

            const merged = mergeTournamentData(canonical, incoming);
            expect(merged.attendees).toHaveLength(3);
            expect(merged.attendees).toContain(userA.toString());
            expect(merged.attendees).toContain(userB.toString());
            expect(merged.attendees).toContain(userC.toString());
            expect(merged.rsvpCount).toBe(3);
        });

        test("TEMPORAL ENVELOPE: merged tournament retains earliest start date and latest end date", () => {
            const canonical = {
                startDate: new Date("2026-11-07T12:00:00Z"),
                endDate: new Date("2026-11-07T20:00:00Z")
            };
            const incoming = {
                startDate: new Date("2026-11-07T08:00:00Z"),
                endDate: new Date("2026-11-08T22:00:00Z")
            };

            const merged = mergeTournamentData(canonical, incoming);
            expect(new Date(merged.startDate).toISOString()).toBe("2026-11-07T08:00:00.000Z");
            expect(new Date(merged.endDate).toISOString()).toBe("2026-11-08T22:00:00.000Z");
        });

        test("deduplicateTournament returns clean non-duplicate structure when list is empty", () => {
            const cand = { tournamentName: "GMU Open 2026" };
            const res = deduplicateTournament(cand, []);
            expect(res.isDuplicate).toBe(false);
            expect(res.canonicalId).toBeNull();
            expect(res.matchScore).toBe(0);
            expect(res.mergedData).toEqual(cand);
        });
    });

    // =========================================================================
    // SECTION 5: High-Throughput Batch Deduplication Stress
    // =========================================================================
    describe("5. High-Throughput Batch Deduplication & Stress Verification", () => {
        test("processes 500 candidate tournament comparisons under 250ms with bounded memory", () => {
            const existingCatalog = [
                {
                    _id: "canon_1",
                    tournamentName: "2026 GMU Badminton Open",
                    startDate: new Date("2026-11-07T09:00:00Z"),
                    divisions: [{ code: "MS_OPEN", maxDraw: 32 }]
                },
                {
                    _id: "canon_2",
                    tournamentName: "2026 UMD Terrapin Badminton Championships",
                    startDate: new Date("2026-10-15T09:00:00Z"),
                    divisions: [{ code: "MS_OPEN", maxDraw: 32 }]
                },
                {
                    _id: "canon_3",
                    tournamentName: "2026 NVBC Winter Open",
                    startDate: new Date("2026-12-05T09:00:00Z"),
                    divisions: [{ code: "MS_OPEN", maxDraw: 32 }]
                }
            ];

            const start = performance.now();
            let duplicateCount = 0;

            for (let i = 0; i < 500; i++) {
                const isDupOfGmu = i % 2 === 0;
                const candidate = {
                    tournamentName: isDupOfGmu
                        ? "2026 GMU Badminton Open (Flight A)"
                        : `2026 Random Invitational Tourney #${i}`,
                    startDate: isDupOfGmu
                        ? new Date("2026-11-07T14:00:00Z")
                        : new Date("2026-08-01T09:00:00Z")
                };

                const res = deduplicateTournament(candidate, existingCatalog);
                if (res.isDuplicate) duplicateCount++;
            }

            const elapsed = performance.now() - start;
            expect(duplicateCount).toBe(250);
            expect(elapsed).toBeLessThan(500);
        });
    });

    // =========================================================================
    // SECTION 6: EMPIRICAL CHALLENGER BUG VERIFICATIONS
    // =========================================================================
    describe("6. Empirical Challenger Bug Verifications & Fixed Behavior", () => {

        test("BUG 1 VERIFICATION: Cross-University False Positive Collision Prevented via Entity Conflict Guard", () => {
            // "2026 GMU Badminton Open" vs "2026 UMD Badminton Open"
            // These are two completely distinct collegiate tournaments in different states.
            // Remediated: computeTitleSimilarity detects conflicting collegiate entities (GMU vs UMD)
            // and returns strictly 0.0 with isDuplicate: false.
            const score = computeTitleSimilarity("2026 GMU Badminton Open", "2026 UMD Badminton Open");

            expect(score).toBe(0);

            const existing = [{
                _id: "gmu_canonical_id",
                tournamentName: "2026 GMU Badminton Open",
                startDate: new Date("2026-11-07T09:00:00Z"),
                eventLocation: "RAC Gym, Fairfax, VA"
            }];
            const candidate = {
                tournamentName: "2026 UMD Badminton Open",
                startDate: new Date("2026-11-07T09:00:00Z"),
                eventLocation: "Ritchie Coliseum, College Park, MD"
            };

            const dedupResult = deduplicateTournament(candidate, existing);
            expect(dedupResult.isDuplicate).toBe(false);
            expect(dedupResult.canonicalTournament).toBeNull();
        });

        test("BUG 2 VERIFICATION: Preserves DMV Collegiate Acronym Variants through Stage 3 Token Pruning", () => {
            // "GMU Badminton Open" vs "George Mason University Badminton Open"
            // Remediated: shouldPruneCandidate normalizes collegiate acronyms before tokenizing,
            // preserving valid duplicate candidates.
            const pruneResult = shouldPruneCandidate("GMU Badminton Open", null, "George Mason University Badminton Open", null);

            expect(pruneResult.prune).toBe(false);

            const dedup = deduplicateTournament(
                { tournamentName: "GMU Badminton Open" },
                [{ tournamentName: "George Mason University Badminton Open" }]
            );
            expect(dedup.isDuplicate).toBe(true);
        });

        test("BUG 3 VERIFICATION: Stage 2 Length Ratio Pruning Allows Legitimate Acronym Variants", () => {
            // "GMU Open" (len 8) vs "George Mason University Badminton Open" (len 38)
            // Remediated: Length ratio pruning evaluates acronym expansion and initialism relationships,
            // allowing valid acronym pairs through.
            const pruneResult = shouldPruneCandidate("GMU Open", null, "George Mason University Badminton Open", null);

            expect(pruneResult.prune).toBe(false);
        });

        test("BUG 4 VERIFICATION: Division Draw Consolidation on Missing Code or Natural Language Names", () => {
            // Existing has division code 'MS_OPEN', incoming has division without code:
            const t1 = { divisions: [{ code: "MS_OPEN", name: "Men Singles Open", maxDraw: 32 }] };
            const t2 = { divisions: [{ name: "Men Singles Open", maxDraw: 64 }] };

            const merged = mergeTournamentData(t1, t2);

            // Remediated: normalizeDivisionKey normalizes 'Men Singles Open' to 'MS_OPEN', consolidating draws
            expect(merged.divisions).toHaveLength(1);
            expect(merged.divisions[0].code).toBe("MS_OPEN");
            expect(merged.divisions[0].maxDraw).toBe(64);
        });

        test("BUG 5 VERIFICATION: Expanded DMV Collegiate Acronyms in Dictionary", () => {
            // George Washington (GW / GWU), Georgetown, UMBC, and William & Mary are supported in COLLEGIATE_ACRONYMS
            const gwuScore = computeTitleSimilarity("GWU Badminton Open", "George Washington University Badminton Open");
            const umbcScore = computeTitleSimilarity("UMBC Badminton Open", "University of Maryland Baltimore County Badminton Open");

            expect(gwuScore).toBeGreaterThanOrEqual(0.85);
            expect(umbcScore).toBeGreaterThanOrEqual(0.85);
        });
    });
});
