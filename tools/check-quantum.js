// Sanity checks for the local simulator: Bell state, GHZ, rotation probabilities.
import { Circuit } from '../src/shared/quantum/circuit.js';
import { simulate, probabilities } from '../src/shared/quantum/statevector.js';
import { createBackend } from '../src/shared/quantum/backend.js';

const approx = (a, b) => Math.abs(a - b) < 1e-9;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) process.exitCode = 1; };

let p = probabilities(simulate(new Circuit(2).h(0).cx(0, 1)));
check('bell |00>+|11>', approx(p[0], 0.5) && approx(p[3], 0.5));
p = probabilities(simulate(new Circuit(3).h(0).cx(0, 1).cx(1, 2)));
check('ghz', approx(p[0], 0.5) && approx(p[7], 0.5));
p = probabilities(simulate(new Circuit(1).ry(Math.PI / 3, 0)));
check('ry(pi/3) P1 = 0.25', approx(p[1], 0.25));
p = probabilities(simulate(new Circuit(1).h(0).rz(1.234, 0).h(0).rx(0.5, 0).y(0).s(0).t(0)));
check('norm preserved', approx(p[0] + p[1], 1));
p = probabilities(simulate(new Circuit(2).x(0).swap(0, 1)));
check('swap', approx(p[2], 1));
p = probabilities(simulate(new Circuit(2).h(0).h(1).cz(0, 1).h(1)));
check('cz phase kickback', approx(p[3], 0.5) && approx(p[0], 0.5));

const res = await createBackend('local', { seed: 1 }).run(new Circuit(2).h(0).cx(0, 1), { shots: 1000 });
check(`backend counts ${JSON.stringify(res.counts)}`, Object.keys(res.counts).every((k) => k === '00' || k === '11'));
console.log(new Circuit(2).h(0).cx(0, 1).toQASM());

// amplitude encoding: prepared distribution must equal the requested one exactly
import { encodeDistribution } from '../src/shared/quantum/sampler.js';
import { makeRng } from '../src/shared/rng.js';
const rng = makeRng('enc');
let worst = 0;
for (let trial = 0; trial < 200; trial++) {
  const K = 1 + Math.floor(rng.next() * 12);
  const probs = Array.from({ length: K }, () => (rng.next() < 0.2 ? 0 : rng.next()));
  if (probs.every((x) => x === 0)) probs[0] = 1;
  const total = probs.reduce((a, b) => a + b, 0);
  const { circuit } = encodeDistribution(probs);
  const got = probabilities(simulate(circuit));
  for (let i = 0; i < got.length; i++) worst = Math.max(worst, Math.abs(got[i] - (i < K ? probs[i] / total : 0)));
}
check(`amplitude encoding exact over 200 random distributions (max err ${worst.toExponential(1)})`, worst < 1e-9);
const two = encodeDistribution([3, 5]).circuit;
check('two-army battle is a single RY', two.ops.length === 1 && two.ops[0].gate === 'ry');

// inverse-CDF sampling used with the QPU randomness pool
import { pickIndex } from '../src/shared/quantum/sampler.js';
{
  const probs = [0.5, 0, 0.3, 0.2];
  const hist = [0, 0, 0, 0];
  for (let i = 0; i < 10000; i++) hist[pickIndex(probs, i / 10000)]++;
  check(`pickIndex matches distribution ${hist.join('/')}`, hist[0] === 5000 && hist[1] === 0 && hist[2] === 3000 && hist[3] === 2000);
  check('pickIndex never returns a zero-probability outcome at the edges', pickIndex([0, 1, 0], 0.999999) === 1 && pickIndex([0, 1, 0], 0) === 1);
}
