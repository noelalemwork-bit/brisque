// Pure layout of the branch braid (no DOM, unit-tested in tools/check-branching.js).
//
// Strands are branches "q:b". Input is the engine's branch history (chronological); output is a list
// of rows, oldest first, each saying which strands occupy which columns before and after it:
//   { kind: 'fork', before, after, q, parent }          two new strands appear (next to their parent)
//   { kind: 'swap', before, after, left, over }          adjacent strands exchange columns (a crossing)
//   { kind: 'junction', before, after, q, t }            both branches of q brought together and linked
//   { kind: 'end', before, after, strands, how }         strands stop: 'collapse' (✕), 'resolve' (●),
//                                                        'reconverge' (both merge into one ●)
//   { kind: 'mark', before, after, strand, t }           a branch moved on (extend)
// Invariants (tested): rows chain (row.after === next.before), no duplicate strands, strands only
// vanish in 'end' rows.

export function braidLayout(history, qubits = []) {
  const order = [];
  const over = new Map(); // strand -> goes over at its next crossing (weave)
  const rows = [];
  const ensure = (id) => { if (!order.includes(id)) { order.push(id); over.set(id, true); } };
  const push = (row) => rows.push({ ...row, after: [...order] });

  // Move strand `id` to column `target` by adjacent swaps (each swap is a crossing row).
  function walk(id, target, cause) {
    let i = order.indexOf(id);
    while (i !== target) {
      const j = i + (target > i ? 1 : -1);
      const u = order[i];
      const v = order[j];
      let top;
      if (over.get(u) !== over.get(v)) top = over.get(u) ? u : v;
      else top = strandQ(u) >= strandQ(v) ? u : v; // tie: the newer thread goes over
      over.set(top, false);
      over.set(top === u ? v : u, true);
      const before = [...order];
      [order[i], order[j]] = [order[j], order[i]];
      push({ kind: 'swap', before, left: Math.min(i, j), over: top, cause });
      i = j;
    }
  }

  for (const h of history) {
    if (h.kind === 'split') {
      const before = [...order];
      const kids = [`${h.q}:0`, `${h.q}:1`];
      const parent = h.parent ? `${h.parent[0]}:${h.parent[1]}` : null;
      const at = parent && order.includes(parent) ? order.indexOf(parent) + 1 : order.length;
      order.splice(at, 0, ...kids);
      for (const k of kids) over.set(k, true);
      push({ kind: 'fork', before, q: h.q, parent: parent && before.includes(parent) ? parent : null, bias: h.bias });
    } else if (h.kind === 'cross') {
      const a = `${h.a[0]}:${h.a[1]}`;
      const b = `${h.b[0]}:${h.b[1]}`;
      ensure(a); ensure(b);
      // a passes b: walk a to b's column (the last swap exchanges them)
      walk(a, order.indexOf(b), 'cross');
    } else if (h.kind === 'coincide') {
      const a = `${h.q}:0`;
      const b = `${h.q}:1`;
      ensure(a); ensure(b);
      // bring the branches side by side (without passing each other), then link them
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (Math.abs(ia - ib) > 1) walk(b, ia < ib ? ia + 1 : ia - 1, 'coincide');
      push({ kind: 'junction', before: [...order], q: h.q, t: h.t });
    } else if (h.kind === 'extend') {
      const id = `${h.q}:${h.b}`;
      if (order.includes(id)) push({ kind: 'mark', before: [...order], strand: id, t: h.to });
    } else if (h.kind === 'collapse') {
      const id = `${h.q}:${h.b}`;
      if (!order.includes(id)) continue;
      const before = [...order];
      order.splice(order.indexOf(id), 1);
      push({ kind: 'end', before, strands: [id], how: 'collapse' });
    } else if (h.kind === 'resolve') {
      const ids = [`${h.q}:0`, `${h.q}:1`].filter((id) => order.includes(id));
      if (!ids.length) continue;
      if (h.reason === 'reconverged' && ids.length === 2) {
        const ia = order.indexOf(ids[0]);
        const ib = order.indexOf(ids[1]);
        if (Math.abs(ia - ib) > 1) walk(ids[1], ia < ib ? ia + 1 : ia - 1, 'reconverge');
      }
      const before = [...order];
      for (const id of ids) order.splice(order.indexOf(id), 1);
      push({ kind: 'end', before, strands: ids, how: h.reason === 'reconverged' ? 'reconverge' : 'resolve' });
    }
  }
  return { rows, live: [...order], owners: Object.fromEntries(qubits.map((q) => [q.id, q.owner])) };
}

const strandQ = (id) => Number(id.split(':')[0]);
