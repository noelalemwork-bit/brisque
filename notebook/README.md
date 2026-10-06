# Brisque × Moth Atlas: workflow notebook

`brisque_moth_workflow.ipynb` shows, end to end, how Brisque (a quantum Risk browser game) uses the
Moth Atlas API: battles compiled to circuits, run on `tomography-api-v2`, certified IBM-QPU randomness from
`comet-qrng-v1` shipped inside the game, territory entanglement on `graph-v1`, a `coin-toss-v1` opening move,
and the pipeline that carries all of it into the browser. It doubles as a plain-language explainer of
superposition, measurement, certified randomness and entanglement.

Already executed: open **`brisque_moth_workflow.html`** in any browser to read it with all plots and timings,
or the `.ipynb` on GitHub / VS Code.

## Re-run it

```powershell
cd notebook
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
# key: MOTH_API_KEY in the environment, or in ../../.env (Noel/.env). It is never printed or saved.
.venv\Scripts\jupyter nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=1800 brisque_moth_workflow.ipynb
.venv\Scripts\jupyter nbconvert --to html brisque_moth_workflow.ipynb
```

- **Credits.** The notebook submits at most 5 emulator jobs (hard cap 8). Each completed job is cached in
  `runs/<label>.json` (Moth-side failures too), so later runs replay those results and spend nothing.
  `BRISQUE_RETRY_FAILED=1` resubmits only jobs whose cached attempt failed, `BRISQUE_FORCE_LIVE=1` resubmits all,
  `BRISQUE_OFFLINE=1` ignores the key entirely (cached / local sections only).
- **No key?** Sections 2, 4 and 6 run fully offline (local simulator, the bundled QPU pool
  `../public/generated/qrng-qpu.json`, the pre-render manifest); live sections replay `runs/` or say they were skipped.
- Section 2 cross-checks the Python encoder against the game's JavaScript (`../src/shared/quantum/sampler.js`)
  when `node` is on PATH.

## Run log (2026-10-05)

| Section | Engine (emu) | Job | Result |
|---|---|---|---|
| 3 | tomography-api-v2, 1024 shots | `57115e9b…` (and an earlier attempt `68476af0…`) | Moth `engine_timeout` at ~63 s; notebook shows the archived 2026-09-25 run of the same QASM (51/43/6 vs 50/44/6) |
| 3 | tomography-api-v2, 1 shot | `595390f2…` (and earlier `69b31ce7…`) | Moth `engine_timeout` at ~63 s; archived 1-shot run shown (165.6 s) |
| 4 | comet-qrng-v1, 20q × 1000 | `106fea75…` | 14.7 s, 64 B, grade `simulator-baseline` (uncertified, as expected on emu) |
| 5 | graph-v1, 5 territories | `297228cb…` | 6.2 s; Ridge–Fen entangled (ZZ = −1, witness 1.57 > 1) |
| 7 | coin-toss-v1, 1 shot | `6a84fc73…` | 5.8 s, tails |

Once tomography-api-v2 is healthy again, re-run with `BRISQUE_RETRY_FAILED=1` to replace the archived §3 data with fresh jobs.
