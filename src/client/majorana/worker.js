// Web Worker: runs the Majorana linking experiment off the main thread. The lattice JSON is bundled
// into this worker's chunk, so it only loads when the first thread resolves.
import lat from './star.json';
import { fuseThreads, useLattice } from './braid.js';

let ready = false;
self.onmessage = ({ data }) => {
  try {
    if (!ready) { useLattice(lat); ready = true; }
    const r = fuseThreads(data.linked, data.seed);
    self.postMessage({ id: data.id, outcomes: r.outcomes, fermion: r.fermion, measurements: r.measurements });
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message ?? err) });
  }
};
