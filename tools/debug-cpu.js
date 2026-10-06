// Replays CPU-only games and audits every action: for move/split, the moving player's expected troops
// may only change at `from` and the destinations, by exactly the reported amount; nothing else moves.
//   node tools/debug-cpu.js [games]
import { generateMap } from '../src/shared/mapgen/generate.js';
import { createEngine, botAction, territoryView } from '../src/shared/game/index.js';
import { createSampler } from '../src/shared/quantum/sampler.js';
import { makeRng } from '../src/shared/rng.js';

const games = Number(process.argv[2] ?? 3);
const expectedAll = (state, pid) => state.worlds[0].board.map((_, t) => territoryView(state, t).expected[pid] ?? 0);
let anomalies = 0;
for (let g = 0; g < games; g++) {
  const map = generateMap(200 + g);
  const engine = createEngine(map, { roundLimit: 30 });
  const rng = makeRng(`dbg:${g}`);
  const sample = createSampler({ rand: makeRng(`dbgs:${g}`).next });
  let { state } = engine.createGame({ players: Array(4).fill({ cpu: true }), seed: g });
  while (state.winner === null) {
    const action = { ...botAction(engine, map, state, rng), player: state.turn.current };
    const before = expectedAll(state, action.player);
    const res = await engine.apply(state, action, { sample });
    const after = expectedAll(res.state, action.player);
    if (action.type === 'move' || action.type === 'split') {
      const touched = new Set([action.from, ...(action.to?.length ? action.to : [action.to])]);
      const moved = res.events.find((e) => e.type === 'moved' || e.type === 'split');
      after.forEach((v, t) => {
        if (!touched.has(t) && Math.abs(v - before[t]) > 1e-9) {
          anomalies++;
          console.log(`g${g} r${state.turn.round} ${action.type} P${action.player} ${JSON.stringify(action)} changed untouched T${t}: ${before[t]} -> ${v}`);
        }
      });
      const delta = [...touched].reduce((a, t) => a + after[t] - before[t], 0);
      if (Math.abs(delta) > 1e-9) { anomalies++; console.log(`g${g} ${action.type} not conserved: ${delta}`, JSON.stringify(action)); }
      // a move out of a territory where the player never had >1 troop in any world must be a no-op
      const maxAt = Math.max(...state.worlds.map((w) => w.board[action.from][action.player] ?? 0));
      if (maxAt <= 1 && (moved?.expected ?? 0) > 0) { anomalies++; console.log(`g${g} moved out of a 1-troop cell`, JSON.stringify(action)); }
    }
    state = res.state;
  }
  console.log(`game ${g}: winner P${state.winner} round ${state.turn.round}`);
}
console.log(`${anomalies} anomalies`);
