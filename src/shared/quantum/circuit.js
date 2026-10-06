// Backend-agnostic circuit description. Plain JSON so it can cross the wire,
// be cached by hash (pre-rendering), and be exported to OpenQASM for remote backends.

export const GATES = {
  h: { qubits: 1, params: 0 },
  x: { qubits: 1, params: 0 },
  y: { qubits: 1, params: 0 },
  z: { qubits: 1, params: 0 },
  s: { qubits: 1, params: 0 },
  t: { qubits: 1, params: 0 },
  rx: { qubits: 1, params: 1 },
  ry: { qubits: 1, params: 1 },
  rz: { qubits: 1, params: 1 },
  cx: { qubits: 2, params: 0 },
  cz: { qubits: 2, params: 0 },
  swap: { qubits: 2, params: 0 },
};

export class Circuit {
  constructor(numQubits) {
    this.numQubits = numQubits;
    this.ops = [];
  }

  add(gate, qubits, params = []) {
    const spec = GATES[gate];
    if (!spec) throw new Error(`unknown gate ${gate}`);
    if (qubits.length !== spec.qubits || params.length !== spec.params) throw new Error(`bad arity for ${gate}`);
    for (const q of qubits) if (q < 0 || q >= this.numQubits) throw new Error(`qubit ${q} out of range`);
    this.ops.push({ gate, qubits, params });
    return this;
  }

  toJSON() {
    return { numQubits: this.numQubits, ops: this.ops };
  }

  static fromJSON({ numQubits, ops }) {
    const c = new Circuit(numQubits);
    for (const op of ops) c.add(op.gate, op.qubits, op.params ?? []);
    return c;
  }

  toQASM() {
    const lines = ['OPENQASM 2.0;', 'include "qelib1.inc";', `qreg q[${this.numQubits}];`, `creg c[${this.numQubits}];`];
    for (const { gate, qubits, params } of this.ops) {
      const p = params.length ? `(${params.join(',')})` : '';
      lines.push(`${gate}${p} ${qubits.map((q) => `q[${q}]`).join(',')};`);
    }
    lines.push('measure q -> c;');
    return lines.join('\n');
  }
}

for (const gate of Object.keys(GATES)) {
  Circuit.prototype[gate] = function (...args) {
    const { qubits, params } = GATES[gate];
    return this.add(gate, args.slice(params, params + qubits), args.slice(0, params));
  };
}
// usage: new Circuit(2).h(0).cx(0, 1).ry(Math.PI / 3, 1)
