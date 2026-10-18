# 5-Component Adversarial Verification Report: M2 Frontend Deliverables

**Author**: `challenger_2` (Adversarial Empirical Verification Challenger)  
**Date**: 2026-10-18T03:44:30Z  
**Branch**: `feature/tournament-enterprise-platform`  
**Parent Agent ID**: `5ad18530-bf1f-4cc3-9b66-63f90ae13188`  
**Verdict**: **REQUEST_CHANGES**

---

## Challenge Summary

- **Overall Risk Assessment**: **HIGH**
- **Core Finding**: While the interactive visualizer architecture (Framer Motion pan/zoom, orthogonal stepped connector generation, RAC Court queue viewer) is solid, empirical stress testing revealed multiple **critical rule inversions and logic bugs** in the scoring/standings engine:
  1. **BWF Set Difference Inversion**: `calculateRoundRobinStandings` prioritizes point differential over set (game) differential, directly violating BWF GCR 16.2.2.
  2. **Falsy 0 Score Collapse**: `Number(m.points1 || m.score1)` in `badmintonRules.js` line 154 causes a shutout score of `0` to evaluate as falsy, crediting a 0-point team with 21 points.
  3. **Missing Redo Functionality**: The Umpire Pad lacks redo capabilities (`handleRedo`, redo stack, and UI button) explicitly tasked in the prompt.
  4. **Broken Receiver Court Visualization**: When Team 2 serves, Team 1's receiving quadrant remains transparent rather than highlighted in cyan.
  5. **Custom Bracket Data Hardcoding**: `<TournamentBracket>` ignores custom `bracketData` when switching to Double Elimination or Round Robin draws, falling back to hardcoded sample mocks.

---

## 1. Observation

### Test Harness Execution
Co-located empirical stress harness `client/src/challenger_m2_adversarial.test.jsx` was created and executed via Vitest:
```powershell
npx vitest run src/challenger_m2_adversarial.test.jsx
```
Execution output:
```
Test Files  1 passed (1)
Tests       18 passed (18)
Duration    2.40s
```

### Specific Verbatim Observations

1. **BWF Set Difference Inversion in Standings** (`client/src/utils/badmintonRules.js` lines 167-175):
   ```javascript
   // Sort by:
   // 1. Matches Won (descending)
   // 2. Point Differential (descending)
   // 3. Points For (descending)
   list.sort((a, b) => {
       if (b.won !== a.won) return b.won - a.won;
       if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
       return b.pointsFor - a.pointsFor;
   });
   ```
   *Empirical Output*:
   ```
   [EMPIRICAL] Round Robin Set Diff vs Point Diff: Team A (SetDiff: +1, PtDiff: +2) Rank: 3, Team B (SetDiff: -1, PtDiff: +7) Rank: 2
   ```
   Team A (Won 3 sets, Lost 2 -> Diff: +1) was ranked *below* Team B (Won 2 sets, Lost 3 -> Diff: -1) simply because Team B had a higher point differential in one blowout match (+7 vs +2).

2. **Falsy 0 Score Bug in Standings** (`client/src/utils/badmintonRules.js` lines 154-155):
   ```javascript
   const pts1 = Number(m.points1 || m.score1) || 0;
   const pts2 = Number(m.points2 || m.score2) || 0;
   ```
   *Empirical Output*:
   ```
   [EMPIRICAL] Zero score test: White pointsFor = 21 (Expected: 0)
   ```
   When `points1: 0`, JavaScript evaluates `0 || m.score1`. Since `0` is falsy, it evaluates to `m.score1` (`21`). A shut-out player is credited with 21 points.

3. **Missing Redo Functionality on Umpire Digital Pad** (`client/src/components/UmpireDigitalPad.jsx` lines 50-52, 160-186, 646-679):
   - Only `history` state exists (`const [history, setHistory] = useState([]);`).
   - `handleUndo` permanently slices and drops the last action (`setHistory(prev => prev.slice(0, -1));`).
   - No `redoStack`, no `handleRedo`, and no Redo button exists in the DOM.
   *Empirical Output*:
   ```
   [EMPIRICAL] Redo button present in UmpirePad: false
   ```

4. **Asymmetric 2D Court Visualizer Receiver Highlighting** (`client/src/components/UmpireDigitalPad.jsx` lines 509-524):
   ```jsx
   {/* TEAM 1 SIDE QUADRANTS */}
   <rect
       x="20"
       y="20"
       width="225"
       height="130"
       fill={currentServer === 1 && serverCourt === 'left' ? 'rgba(74, 222, 128, 0.4)' : 'transparent'}
   />
   <rect
       x="20"
       y="150"
       width="225"
       height="130"
       fill={currentServer === 1 && serverCourt === 'right' ? 'rgba(74, 222, 128, 0.4)' : 'transparent'}
   />
   ```
   *Empirical Output*:
   ```
   [EMPIRICAL] Team 1 Left Rect fill when Team 2 serves: "transparent"
   [EMPIRICAL] Team 1 Right Rect fill when Team 2 serves: "transparent"
   ```
   When Team 2 serves, Team 1 is the receiver, but neither of Team 1's quadrants is ever highlighted (both remain `transparent`). In contrast, when Team 1 serves, Team 2's receiving box correctly highlights in cyan (`rgba(56, 189, 248, 0.35)`).

5. **Hardcoding of Double Elimination and Round Robin Data** (`client/src/components/TournamentBracket.jsx` lines 94-96, 167-169):
   ```javascript
   if (drawFormat === 'DOUBLE_ELIMINATION') {
       if (doubleElimTab === 'winners') return SAMPLE_DOUBLE_ELIMINATION.winnersRounds;
       if (doubleElimTab === 'losers') return SAMPLE_DOUBLE_ELIMINATION.losersRounds;
       return [SAMPLE_DOUBLE_ELIMINATION.grandFinals];
   }
   ```
   *Empirical Output*:
   ```
   [EMPIRICAL] Double Elim Custom Data Audit: custom teams found = 0, hardcoded sample teams found = 2
   ```
   Passing custom `bracketData` to `<TournamentBracket bracketData={customData} />` is ignored when switching to Double Elimination or Round Robin draws.

6. **Sudden Death Golden Point (29-29) Asymmetry** (`client/src/utils/badmintonRules.js` lines 57-71):
   ```javascript
   if (checkGameWinner(s1 + 1, s2, targetScore, cap) === 1) return 1;
   if (checkGameWinner(s1, s2 + 1, targetScore, cap) === 2) return 2;
   ```
   *Empirical Output*:
   ```
   [EMPIRICAL] getGamePoint(29, 29) returned: 1
   [EMPIRICAL] getMatchPoint(29, 29, 1, 1, 2) returned: 1
   ```
   At 29-29, either player who scores the 30th point wins. The function unconditionally returns `1` (Team 1), causing the UI alert to exclusively state that Team 1 is at game/match point.

---

## 2. Logic Chain

1. **BWF Regulatory Violation (Observation 1)**:
   - Official BWF General Competition Regulations (GCR 16.2.2.2) mandate: If two players/pairs have won the same number of matches, the ranking MUST be determined by the difference of games (sets) won and lost.
   - Point difference is strictly a secondary tiebreaker applied only when set differences are tied.
   - In `calculateRoundRobinStandings`, `pointDiff` is evaluated directly after `won`, and set difference is completely omitted from the sort criteria.
   - Thus, a team with a negative set differential (-1) will erroneously rank above a team with a positive set differential (+1) if it had a large point margin in one game.

2. **Falsy JavaScript Evaluation (Observation 2)**:
   - In JavaScript, `0` is falsy.
   - Expression `Number(m.points1 || m.score1)` evaluates `m.points1` first. If `m.points1 === 0`, the OR expression falls back to `m.score1`.
   - In a shutout match where a player lost 0-21, `points1` is 0 and `score1` may be 21 (or prior game score). The player is wrongly credited with 21 points instead of 0.

3. **Undo/Redo Contract Violation (Observation 3)**:
   - The original request explicitly mandated: "verify service court odd/even parity under all score combinations, rapid undo/redo stability".
   - The worker implemented an undo stack that discards popped history without a corresponding `redoStack` or redo handler.
   - Any accidental undo by an umpire cannot be undone, risking data loss during live match umpiring.

4. **DOM Rendering & UI Parity (Observation 4)**:
   - The 2D SVG court has four quadrants.
   - Team 1's quadrants only check `currentServer === 1`.
   - When Team 2 serves, Team 1 receives. Because the condition ignores `currentServer === 2 && receiverCourt === ...`, the receiver court remains unhighlighted.

---

## 3. Caveats

- **Collision Prevention under Large Brackets**: Stress tested up to 64 players / 6 rounds (63 matches). Orthogonal connector routing and center-Y arithmetic mean calculations (`centerY = (f1.centerY + f2.centerY)/2`) held up without any vertical card overlaps (minimum gap $\ge 36$px).
- **Socket.io Sync**: WebSocket broadcast logic was tested via vitest mocks rather than a multi-node distributed cluster.
- **Mobile Viewports**: Tested at 320px, 360px, 375px, and 414px viewports; the bracket container's `overflow: hidden` and touch panning prevent outer document horizontal scroll explosions.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

The frontend implementation demonstrates strong UI styling and visual layout polish, but contains critical flaws in core tournament logic and missing requirements. The following actionable changes are required from `worker_frontend_m2`:

1. **Fix `calculateRoundRobinStandings` in `client/src/utils/badmintonRules.js`**:
   - Compute `setDiff: t.setsWon - t.setsLost` for each team.
   - Update sort comparator to prioritize:
     1. Matches Won (`b.won - a.won`)
     2. Sets Differential (`b.setDiff - a.setDiff`)
     3. Points Differential (`b.pointDiff - a.pointDiff`)
     4. Points Won (`b.pointsFor - a.pointsFor`)
   - Fix falsy 0 bug on lines 154-155:
     ```javascript
     const pts1 = Number(m.points1 !== undefined ? m.points1 : m.score1) || 0;
     const pts2 = Number(m.points2 !== undefined ? m.points2 : m.score2) || 0;
     ```
   - For exact ties where all metrics match, assign equal rank (e.g. both Rank 1) or apply head-to-head winner.

2. **Implement Redo Stack in `client/src/components/UmpireDigitalPad.jsx`**:
   - Add `const [redoStack, setRedoStack] = useState([]);`.
   - On `handleScorePoint`, clear `redoStack`.
   - On `handleUndo`, push current state to `redoStack`.
   - Add `handleRedo` and render a `Redo Point` button adjacent to `Undo Point`.

3. **Fix 2D Court Receiver Highlighting in `client/src/components/UmpireDigitalPad.jsx`**:
   - Update Team 1 Left Court fill (lines 509-515) to highlight in cyan when Team 2 is serving and receiver court is left:
     ```jsx
     fill={
         (currentServer === 1 && serverCourt === 'left')
             ? 'rgba(74, 222, 128, 0.4)'
             : (currentServer === 2 && receiverCourt === 'left')
                 ? 'rgba(56, 189, 248, 0.35)'
                 : 'transparent'
     }
     ```
   - Update Team 1 Right Court fill (lines 517-523) similarly for right receiving court.

4. **Honor Custom `bracketData` in `client/src/components/TournamentBracket.jsx`**:
   - In lines 94-96, use `activeData.winnersRounds || SAMPLE_DOUBLE_ELIMINATION.winnersRounds`.
   - In lines 167-169 and 359-402, use `activeData.teams || SAMPLE_ROUND_ROBIN.teams` and `activeData.matches || SAMPLE_ROUND_ROBIN.matches`.

5. **Fix Golden Sudden Death Game/Match Point Detection**:
   - At 29-29, return an indicator that both players are at game/match point (e.g. `12` or `{ team1: true, team2: true }`), or display a unified alert: "GOLDEN POINT — Next point wins the game/match!".

---

## 5. Verification Method

To verify these findings and validate fixes:

1. **Run Empirical Challenger Test Suite**:
   ```powershell
   cd "D:\GMU Fall 2026\GMU-Badminton-App\client"
   npx vitest run src/challenger_m2_adversarial.test.jsx
   ```
2. **Run Full Client Test Suite**:
   ```powershell
   npm test
   # All 20 test files should pass cleanly
   ```
3. **Run Linter & Production Build**:
   ```powershell
   npm run lint
   npm run build
   ```

**Invalidation Conditions**:
- If `calculateRoundRobinStandings` ranks a team with set differential `-1` above a team with `+1`, the implementation is invalid.
- If a team shutout at 0 points receives 21 points in pool standings, the implementation is invalid.
- If `UmpireDigitalPad` does not support Redo, the implementation is invalid.
- If Team 1's receiving court remains transparent during Team 2's serve, the visualizer is invalid.
