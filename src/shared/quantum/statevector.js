// Small exact statevector simulator. Fine up to ~20 qubits; battles should stay far below that.
// Bitstrings are little-endian like Qiskit: qubit 0 is the rightmost character.

export function simulate(circuit) {
  const n = circuit.numQubits;
  const dim = 1 << n;
  const re = new Float64Array(dim);
  const im = new Float64Array(dim);
  re[0] = 1;

  for (const { gate, qubits, params } of circuit.ops) {
    switch (gate) {
      case 'cx': controlled(re, im, qubits[0], qubits[1], X); break;
      case 'cz': controlled(re, im, qubits[0], qubits[1], Z); break;
      case 'swap': swap(re, im, qubits[0], qubits[1]); break;
      default: single(re, im, qubits[0], MATRICES[gate](params[0]));
    }
  }
  return { re, im };
}

export function probabilities({ re, im }) {
  const p = new Float64Array(re.length);
  for (let i = 0; i < re.length; i++) p[i] = re[i] * re[i] + im[i] * im[i];
  return p;
}

export function sample(circuit, shots, rand) {
  const probs = probabilities(simulate(circuit));
  const cdf = new Float64Array(probs.length);
  let acc = 0;
  for (let i = 0; i < probs.length; i++) cdf[i] = acc += probs[i];
  const counts = {};
  for (let s = 0; s < shots; s++) {
    const r = rand() * acc;
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1; else hi = mid;
    }
    const key = lo.toString(2).padStart(circuit.numQubits, '0');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// 2x2 matrices as [a_re, a_im, b_re, b_im, c_re, c_im, d_re, d_im] for [[a, b], [c, d]]
const R2 = Math.SQRT1_2;
const X = [0, 0, 1, 0, 1, 0, 0, 0];
const Z = [1, 0, 0, 0, 0, 0, -1, 0];
const MATRICES = {
  h: () => [R2, 0, R2, 0, R2, 0, -R2, 0],
  x: () => X,
  y: () => [0, 0, 0, -1, 0, 1, 0, 0],
  z: () => Z,
  s: () => [1, 0, 0, 0, 0, 0, 0, 1],
  t: () => [1, 0, 0, 0, 0, 0, R2, R2],
  rx: (t) => { const c = Math.cos(t / 2), s = Math.sin(t / 2); return [c, 0, 0, -s, 0, -s, c, 0]; },
  ry: (t) => { const c = Math.cos(t / 2), s = Math.sin(t / 2); return [c, 0, -s, 0, s, 0, c, 0]; },
  rz: (t) => { const c = Math.cos(t / 2), s = Math.sin(t / 2); return [c, -s, 0, 0, 0, 0, c, s]; },
};

function applyPair(re, im, i0, i1, m) {
  const ar = re[i0], ai = im[i0], br = re[i1], bi = im[i1];
  re[i0] = m[0] * ar - m[1] * ai + m[2] * br - m[3] * bi;
  im[i0] = m[0] * ai + m[1] * ar + m[2] * bi + m[3] * br;
  re[i1] = m[4] * ar - m[5] * ai + m[6] * br - m[7] * bi;
  im[i1] = m[4] * ai + m[5] * ar + m[6] * bi + m[7] * br;
}

function single(re, im, q, m) {
  const bit = 1 << q;
  for (let i = 0; i < re.length; i++) if (!(i & bit)) applyPair(re, im, i, i | bit, m);
}

function controlled(re, im, c, t, m) {
  const cb = 1 << c;
  const tb = 1 << t;
  for (let i = 0; i < re.length; i++) if (i & cb && !(i & tb)) applyPair(re, im, i, i | tb, m);
}

function swap(re, im, a, b) {
  const ab = 1 << a;
  const bb = 1 << b;
  for (let i = 0; i < re.length; i++) {
    if (i & ab && !(i & bb)) {
      const j = (i & ~ab) | bb;
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
}
