// The war's echo: at game over a quantum reservoir on Moth (qrc-train-v2, then qrc-gen-v2) learns the
// sequence of moves the players made and predicts how the war would have gone on.
//
// Each accepted action is one token, "player:type" (deploy, move, split, bomb), so the vocabulary is at
// most 6 players × 4 kinds and the prediction reads straight back as moves.

import { quantumTrace } from './quantum.js';

const KINDS = new Set(['deploy', 'move', 'split', 'bomb']);

export function warMoves(state, max = 120) {
  const moves = state.log
    .map(({ action }) => action)
    .filter((a) => KINDS.has(a.type))
    .map((a) => `${a.player ?? 0}:${a.type}`)
    .filter((tok, i, all) => !(i >= 2 && tok.endsWith(':deploy') && all[i - 1] === tok && all[i - 2] === tok)); // a run of deploys is one gesture
  while (moves.length && moves.length < 16) moves.push(...moves.slice(0, 16 - moves.length)); // short games still train
  return moves.slice(-max);
}

export const parseMove = (tok) => { const [p, type] = String(tok).split(':'); return { player: Number(p), type }; };

// Trains the reservoir on the war and predicts `length` moves. Reports both jobs to the quantum log.
export async function predictMoves(moth, moves, { length = 16, seed = 7 } = {}) {
  const run = async (engine, params, inputFiles) => {
    const ev = (phase, info = {}) => quantumTrace.emit({ kind: 'job', id: engine, engine, mode: 'emu', phase, ...info });
    try {
      const res = await moth.client.job(engine, params, { onPhase: ev, inputFiles, timeoutMs: 5 * 60 * 1000 });
      ev('done', { ms: res.ms, jobId: res.jobId, detail: engine === 'qrc-gen-v2' ? `${res.status?.result?.length ?? 0} moves predicted` : 'reservoir trained' });
      return res;
    } catch (err) {
      ev('failed', { detail: err.message });
      throw err;
    }
  };
  const trained = await run('qrc-train-v2', { sequence: moves, num_qubits: 5, epochs: 40, shots: 1000, sample_length: 8, washout: 2, seed });
  const state = trained.outputs?.find((o) => o.slot === 'state')?.output_asset_id ?? trained.status?.outputs?.[0]?.output_asset_id;
  if (!state) throw new Error('reservoir returned no model');
  const gen = await run('qrc-gen-v2', { length, variation: 0.8, random_seed: seed, initial_events: moves.slice(-8) }, { state });
  const out = gen.status?.result;
  if (!Array.isArray(out) || !out.length) throw new Error('reservoir predicted nothing');
  return out.map(String);
}
