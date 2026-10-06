// Names for continents and territories. Each continent gets an abstract-architecture theme (these
// continents will later be dressed with matching structures); its territories draw names from that
// theme's vocabulary. Deterministic per map seed; never changes geometry.

import { makeRng } from '../rng.js';

export const THEMES = [
  {
    id: 'monolith', continent: ['The Monoliths', 'Monolith Reach', 'Slab Country'],
    words: ['Basalt', 'Plinth', 'Lintel', 'Cairn', 'Menhir', 'Keystone', 'Dolmen', 'Stele', 'Quarry', 'Bedrock', 'Ashlar', 'Tor'],
    forms: ['{w}', '{w} Field', 'High {w}', '{w} Rise', 'The {w}'],
  },
  {
    id: 'arcade', continent: ['The Arcades', 'Colonnade Coast', 'Portico March'],
    words: ['Portico', 'Loggia', 'Colonnade', 'Atrium', 'Cloister', 'Vault', 'Archway', 'Nave', 'Apse', 'Gallery', 'Stoa', 'Rotunda'],
    forms: ['{w}', 'Low {w}', '{w} Walk', 'Old {w}', 'The {w}'],
  },
  {
    id: 'spire', continent: ['The Spires', 'Needle Heights', 'Steeple Reach'],
    words: ['Needle', 'Steeple', 'Pinnacle', 'Minaret', 'Finial', 'Belfry', 'Lantern', 'Campanile', 'Aiguille', 'Mast', 'Beacon', 'Pike'],
    forms: ['{w}', '{w} Point', 'North {w}', 'Twin {w}', 'The {w}'],
  },
  {
    id: 'lattice', continent: ['The Lattice', 'Truss Lands', 'Gridwork'],
    words: ['Truss', 'Girder', 'Trellis', 'Gantry', 'Scaffold', 'Strut', 'Weave', 'Mesh', 'Joist', 'Span', 'Rivet', 'Brace'],
    forms: ['{w}', '{w} Yard', 'Upper {w}', '{w} Works', 'The {w}'],
  },
  {
    id: 'ziggurat', continent: ['The Terraces', 'Ziggurat Plain', 'Stepwell Basin'],
    words: ['Terrace', 'Stepwell', 'Tier', 'Mastaba', 'Platform', 'Landing', 'Ramp', 'Dais', 'Stair', 'Ledge', 'Bench', 'Plateau'],
    forms: ['{w}', 'Seventh {w}', '{w} Steps', 'Sunken {w}', 'The {w}'],
  },
  {
    id: 'dome', continent: ['The Domes', 'Cupola Fields', 'Vaulted Shore'],
    words: ['Cupola', 'Dome', 'Oculus', 'Drum', 'Lantern', 'Pendentive', 'Shell', 'Bubble', 'Hemisphere', 'Canopy', 'Crown', 'Orb'],
    forms: ['{w}', 'Glass {w}', '{w} Hollow', 'Great {w}', 'The {w}'],
  },
  {
    id: 'bastion', continent: ['The Bastions', 'Rampart Ring', 'Citadel March'],
    words: ['Bastion', 'Rampart', 'Redoubt', 'Parapet', 'Barbican', 'Keep', 'Glacis', 'Merlon', 'Postern', 'Ravelin', 'Casemate', 'Curtain'],
    forms: ['{w}', 'Outer {w}', '{w} Gate', 'Broken {w}', 'The {w}'],
  },
  {
    id: 'aqueduct', continent: ['The Aqueducts', 'Channel Country', 'Cistern Reach'],
    words: ['Cistern', 'Aqueduct', 'Sluice', 'Culvert', 'Weir', 'Conduit', 'Fountain', 'Basin', 'Spillway', 'Lock', 'Reservoir', 'Canal'],
    forms: ['{w}', '{w} Run', 'Dry {w}', '{w} Head', 'The {w}'],
  },
];

export function nameMap(map) {
  const rng = makeRng(`names:${map.seed}`);
  const themes = rng.shuffle([...THEMES]);
  const used = new Set();
  const continents = map.continents.map((c, i) => {
    const theme = themes[i % themes.length];
    return { theme: theme.id, name: rng.pick(theme.continent) };
  });
  const territories = map.territories.map((t) => {
    const theme = themes[t.continent % themes.length];
    for (let k = 0; k < 40; k++) {
      const name = rng.pick(theme.forms).replace('{w}', rng.pick(theme.words));
      if (!used.has(name)) { used.add(name); return name; }
    }
    return `${rng.pick(theme.words)} ${t.id}`;
  });
  return { continents, territories };
}
