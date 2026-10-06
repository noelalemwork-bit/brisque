// Tutorial: a short 1v1 against a passive sparring CPU, with a coach card that ticks off each move as the
// player makes it (deploy, expand, attack, split, bomb, end turn). Steps can be done in any order.

import { generateMap } from '../shared/mapgen/generate.js';
import { createEngine } from '../shared/game/index.js';
import { certainOwner } from '../shared/game/worlds.js';
import { h, clear } from './ui/dom.js';

export const TUTORIAL_PLAYERS = [
  { name: 'You', color: '#e05a47', cpu: false },
  { name: 'Sparring CPU', color: '#3f7fd9', cpu: true },
];
export const TUTORIAL_RULES = { roundLimit: 8 };

// A board where one of your territories borders the CPU and another borders empty land, so every step is
// possible on turn one. Deterministic: the first seed that qualifies.
export function tutorialSeed() {
  for (let seed = 1; seed < 500; seed++) {
    const map = generateMap(seed);
    const { state } = createEngine(map, TUTORIAL_RULES).createGame({ players: TUTORIAL_PLAYERS, seed });
    const owner = (t) => certainOwner(state.worlds, t);
    const mine = map.territories.map((_, t) => t).filter((t) => owner(t) === 0);
    const nb = (t) => map.territories[t].neighbors;
    const bordersCpu = mine.some((t) => nb(t).some((n) => owner(n) === 1));
    const bordersEmpty = mine.filter((t) => nb(t).some((n) => owner(n) === null && Object.keys(state.worlds[0].board[n]).length === 0)).length >= 1;
    if (bordersCpu && bordersEmpty) return seed;
  }
  return 1;
}

// The sparring partner: drops two troops on its emptiest territory and passes. Never attacks, splits or bombs.
export function passivePolicy(engine, map, state) {
  const me = state.turn.current;
  const left = Math.min(2 - state.turn.deployed, state.players[me].inventory);
  if (left > 0) {
    const mine = map.territories.map((_, t) => t).filter((t) => certainOwner(state.worlds, t) === me);
    const t = mine.sort((a, b) => (state.worlds[0].board[a][me] ?? 0) - (state.worlds[0].board[b][me] ?? 0))[0];
    if (t !== undefined && !engine.validate(state, { type: 'deploy', territory: t, n: left, player: me })) return { type: 'deploy', territory: t, n: left };
  }
  return { type: 'endTurn' };
}

const STEPS = [
  { id: 'deploy', title: 'Deploy', text: 'Right-click one of your red territories to add a troop from your reserve (Shift+right-click adds 5).' },
  { id: 'expand', title: 'Expand', text: 'Click one of your territories, then a neighbouring empty one, to move troops in.' },
  { id: 'attack', title: 'Attack', text: "Move onto the CPU's blue land next door. Two armies in one place is a battle (⚔): nobody has won until it is measured." },
  { id: 'split', title: 'Split', text: 'Press S, click your territory, then two destinations. Your troops now exist in both futures, drawn see-through.' },
  { id: 'bomb', title: 'Bomb', text: 'Press B and hover the battle: the card shows every outcome, its odds and the circuit that decides it. Click to measure.' },
  { id: 'end', title: 'End turn', text: 'Press Space. Only land you hold with certainty pays income next turn.' },
];

// Coach card: the next undone step large, the rest as ticks. Reads the match's events; never blocks play.
export function createCoach(root, match, { onSkip }) {
  const done = new Set();
  const el = h('div.coach');
  root.append(el);
  let finished = false;

  function render() {
    clear(el);
    if (finished) {
      el.append(
        h('div.coach-h', { text: "YOU'RE READY" }),
        h('p', { text: 'Now beat the sparring CPU: take all its land, or hold more land with certainty than it does when round 8 ends. Hover any territory for its odds; press Q for the quantum log.' }),
        h('button.btn', { on: { click: () => el.remove() } }, 'Got it'),
      );
      return;
    }
    const next = STEPS.find((s) => !done.has(s.id));
    el.append(
      h('div.coach-h', {}, h('span', { text: `TUTORIAL · ${done.size} of ${STEPS.length}` }), h('button.coach-skip', { on: { click: () => { el.remove(); onSkip?.(); } } }, 'Skip')),
      h('b.coach-title', { text: next.title }),
      h('p', { text: next.text }),
      h('div.coach-steps', {}, ...STEPS.map((s) => h('span', { class: done.has(s.id) ? 'done' : s === next ? 'now' : '', title: s.title, text: done.has(s.id) ? '✓' : s.title[0] }))),
    );
  }

  match.on('state', ({ events }) => {
    let changed = false;
    const mark = (id) => { if (!done.has(id)) { done.add(id); changed = true; } };
    for (const e of events) {
      if (e.player !== undefined && e.player !== 0 && e.type !== 'contestStarted') continue;
      if (e.type === 'deployed') mark('deploy');
      else if (e.type === 'moved') mark('expand');
      else if (e.type === 'contestStarted' && match.state.turn.current === 0) mark('attack');
      else if (e.type === 'split') mark('split');
      else if (e.type === 'bombed') mark('bomb');
      else if (e.type === 'turnEnded') mark('end');
    }
    if (changed) {
      if (done.size === STEPS.length) finished = true;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      render();
    }
  });
  render();
  return { dispose() { el.remove(); } };
}
