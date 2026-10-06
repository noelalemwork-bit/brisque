// CPU-vs-CPU balance sweep: how long do games last under different rule variants?
//   node tools/sim-balance.js [gamesPerVariant]
import { generateMap } from '../src/shared/mapgen/generate.js';
import { createEngine, botAction } from '../src/shared/game/index.js';
import { createSampler } from '../src/shared/quantum/sampler.js';
import { makeRng } from '../src/shared/rng.js';

const variants = {
  'brief (losers return 100%)': {},
  'losers return 50%': { returnFraction: 0.5 },
  'losers return 0% (Risk)': { returnFraction: 0 },
  'return 50% + Lanchester': { returnFraction: 0.5, battleExponent: 2 },
};
const games = Number(process.argv[2] ?? 4);
for (const [name, rules] of Object.entries(variants)) {
  const rounds = [];
  let unfinished = 0;
  const t0 = performance.now();
  for (let g = 0; g < games; g++) {
    const map = generateMap(100 + g);
    const engine = createEngine(map, rules);
    const rng = makeRng(`bal:${g}`);
    const sample = createSampler({ rand: makeRng(`s:${g}`).next });
    let { state } = engine.createGame({ players: Array(3).fill({ cpu: true }), seed: g });
    while (state.winner === null && state.turn.round <= 150) {
      state = (await engine.apply(state, { ...botAction(engine, map, state, rng), player: state.turn.current }, { sample })).state;
    }
    if (state.winner === null) unfinished++; else rounds.push(state.turn.round);
  }
  rounds.sort((a, b) => a - b);
  console.log(`${name.padEnd(28)} finished ${rounds.length}/${games}  rounds ${rounds.join(',') || '-'}  (${((performance.now() - t0) / 1000).toFixed(0)}s)`);
}
