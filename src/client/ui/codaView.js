// Game-over card: the war's last moves, then the moves a quantum reservoir predicts would come next
// (see coda.js). Without a Moth connection it shows the war alone. Silent by design.

import { h, clear } from './dom.js';
import { icons } from './icons.js';
import { warMoves, parseMove, predictMoves } from '../coda.js';

const SHOWN = 12; // past moves on the strip

export function createCodaView({ state, moth }) {
  const moves = warMoves(state);
  let future = [];
  let disposed = false;
  const status = h('small.coda-status');
  const strip = h('div.coda-strip');
  const el = h('div.coda', {}, h('div.coda-head', {}, h('b', { text: 'WHAT COMES NEXT' })), strip, status);

  const chip = (tok, predicted) => {
    const { player, type } = parseMove(tok);
    const p = state.players[player];
    return h('span.coda-move', { class: `coda-move${predicted ? ' predicted' : ''}`, style: { '--c': p?.color ?? '#f2ead8' }, title: `${p?.name ?? '?'} · ${type}` },
      (icons[type] ?? icons.move)(type === 'bomb' ? p?.color : undefined));
  };
  function draw() {
    clear(strip).append(
      ...moves.slice(-SHOWN).map((t) => chip(t, false)),
      h('span.coda-now', { text: 'now' }),
      ...(future.length ? future.map((t) => chip(t, true)) : [h('span.coda-wait', { text: moth ? '…' : '' })]),
    );
  }

  draw();
  if (!moth) {
    status.textContent = "This war's last moves. In a Moth mode, a quantum reservoir learns them and predicts what the players would do next.";
  } else {
    status.textContent = 'A 5-qubit quantum reservoir on Moth is learning how this war was fought (qrc-train-v2)…';
    predictMoves(moth, moves, { seed: state.log.length })
      .then((out) => {
        if (disposed) return;
        future = out;
        draw();
        status.textContent = 'Left of "now": how the war ended. Right: the next 16 moves a quantum reservoir predicts after learning it (Moth qrc-train-v2 → qrc-gen-v2).';
      })
      .catch((err) => { if (!disposed) status.textContent = `The reservoir could not finish this time (${err.message}).`; });
  }
  return { el, dispose() { disposed = true; } };
}
