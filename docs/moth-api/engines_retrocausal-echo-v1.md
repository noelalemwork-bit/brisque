Retrocausal EchoRetrocausal Echo

POST/api/v1/engines/retrocausal-echo-v1/processliveRun in dashboard ↗Try the API call ↗

Engineretrocausal-echo-v1
Versionv0.1.2
Usage2 credits / run
UpdatedSep 15, 2026

retrocausal-echo-v1 — Retrocausal Echo. A media engine.

Audio → Audio2 file slotsfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/retrocausal-echo-v1/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "allow_high_shots": false,

    "decay": 0.9,

    "depth": 8,

    "diffusion_ms": 0,

    "disorder": 0,

    "division": 0.25,

    "emit": "audio",

    "exact": true,

    "feedback": 0,

    "feedback_source": "kick",

    "fractional_gates": true,

    "grain_ms": 120,

    "include_tap_map": true,

    "ir_seconds": 3,

    "kick": "Z",

    "lattice": "chain",

    "machine": "aer",

    "master_ms": 640,

    "max_regen": 24,

    "min_level": 0.05,

    "mix": 0.6,

    "n_sites": 8,

    "negative_mode": "invert",

    "output_format": "pcm_16",

    "shots": 4096,

    "sr": 44100,

    "stereo_width": 1,

    "theta_x": 0.9424777960769379,

    "theta_z": 0,

    "theta_zz": 1.0995574287564276,

    "twirls": 1,

    "via": "direct"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionallow_high_shotsbooleannofalsePermit shots above 8192.bpmnumber | nullnonullTempo. When set, one depth step = division of a bar instead of master_ms/depth.decaynumberno0.9Extra level roll-off per depth step, on top of |F|. 1.0 = none. (max 1)depthintegerno8Echo depths t = 1..depth — the tap time slots. (min 1, max 32)diffusion_msnumberno0Square lattice only: y spreads taps by up to ±diffusion_ms/2 inside their depth slot. (min 0, max 500)disordernumberno0Additive per-gate angle jitter, std in radians. Localises the echo; the only lever that makes seed audible. (min 0, max 1)divisionnumberno0.25Step as a fraction of a beat when bpm is set. 0.25 sixteenth · 0.5 eighth · 0.75 dotted eighth · 0.3333 eighth-triplet · 1.0 quarter. (max 4)emitstringno"audio"audio renders a WAV — your input processed, or the effect's own impulse response when no audio is supplied. map skips rendering entirely and returns only the time-mapped tap list, which is what a sequencer or a DAW plugin wants: same tap map, no audio work, no WAV to download. (one of audio, map)exactbooleannotrueaer only: exact expectation values instead of sampling.feedbacknumberno0Regeneration loop gain. The bus of selected taps is normalised first, so this is the fraction of signal that comes back round — always convergent, and 0.6 sounds like 0.6 on a rack unit rather than diverging. (min 0)feedback_sourcestringno"kick"Which taps regenerate. kick: only the kick site's column (the classic single regeneration tap). all: every tap. (one of kick, all)fractional_gatesbooleannotrueUse native rzz/rx where available.grain_msnumberno120Grain length for reverse mode. Short → stuttered; long → whole phrases backwards. (max 2000)heightinteger | nullnonullSquare lattice height. Required for square.include_tap_mapbooleannotrueAlso emit the rendered tap map inline in the result (it is always written to taps.json).ir_secondsnumberno3With no audio input, render the effect's own stereo impulse response for this long. (max 30)kickstringno"Z"Perturbation Pauli applied to the kick site between U and U†. (one of Z, Y, X)kick_siteinteger | nullnonullRegeneration source: the site that receives the impulse. Default: centre.latticestringno"chain"Delay-line topology. chain: site → pan. square (Nighthawk-native): x → pan, y → diffusion. (one of chain, square)machinestringno"aer"Backend for the measurement: 'aer' (local, noiseless) or an IBM backend name such as 'ibm_phoenix'.master_msnumberno640Length of the master delay line in ms. One depth step = master_ms / depth. Ignored when bpm is set. (max 8000)max_regenintegerno24Cap on regeneration iterations. (min 1, max 64)min_levelnumberno0.05|F| threshold below which a tap is dropped. (min 0, max 1)mixnumberno0.6Dry/wet. 0 = dry, 1 = wet only. (min 0, max 1)n_sitesintegerno8Chain length in qubits (= pan positions). Ignored for square. (min 2, max 156)negative_modestringno"invert"What a negative F does. invert: flip polarity (phase-cancelling echo). reverse: play that tap's grains backwards. phase: rotate by arg(F) via a Hilbert transform — the only mode that uses F_im, so pair it with theta_z > 0. (one of invert, reverse, phase)output_formatstringno"pcm_16"WAV sample format. (one of pcm_16, pcm_32, float_32)qpu_instancestring | nullnonullIBM Quantum instance CRN. As with the token: required for via: direct, optional BYOK for via: mothbackend. (format password)qpu_tokenstring | nullnonullIBM Quantum API token when machine is an IBM backend; falls back to QISKIT_IBM_TOKEN. (format password)ref_floornumber | nullnonull|c_ref| below which a tap is dropped as unnormalisable. Default: 4/sqrt(shots), ~0 for exact simulation. Raise it to prune taps the noise floor cannot support.seedinteger | nullnonullRNG seed for the disorder realisation. Only audible when disorder > 0. Drawn as a 31-bit integer and returned in provenance if omitted. Capped at 2**53-1: above that, moth-api (Go) and any browser client re-spell the integer as a float64 and it stops matching the seed you sent.shotsintegerno4096Shots per circuit. Ignored when machine='aer' and exact=true. Above 8192 requires allow_high_shots. (min 1)srintegerno44100Sample rate. Ignored when an audio file is supplied — that file's own rate is used. (min 8000, max 192000)stereo_widthnumberno1Scales the site → pan spread. 0 = mono. (min 0, max 1)tail_msnumber | nullnonullSilence appended to the input so the last tap and its regenerations fit. Default: computed from the tap map.theta_xnumberno0.9424777960769379Transverse kick per layer (RX, rad) — the 'how quantum' dial. Low → loud regular taps; high → inverted, attenuated, erased. (min 0, max 3.141592653589793)theta_znumberno0Phase layer (RZ, rad). 0 → real, two-signed taps. >0 → complex F, which negative_mode: phase renders as rotation. (min 0, max 3.141592653589793)theta_zznumberno1.0995574287564276Coupling per layer (RZZ, rad). Non-monotonic: ≈0.25π is the sparse setting. π is a Clifford (no scrambling). θ and π−θ coincide only when theta_x = 0, not at the default drive, so the upper half of the range is its own territory. The sign is invisible unless theta_z > 0. (max 3.141592653589793)twirlsintegerno1ZZ-commutant Pauli twirls per circuit, averaged. Only useful on hardware: it randomises off-axis coherent error in the couplings. Multiplies the circuit count, so it multiplies QPU time. (min 1, max 32)viastringno"direct"How to reach the machine. direct: this engine drives qiskit-ibm-runtime itself (analytic emulation, native fractional gates, one batched QPU session). mothbackend: route through Moth's execution service, which holds the credentials — sampled only, so no analytic mode, no fractional gates, and one submission per circuit. (one of direct, mothbackend)widthinteger | nullnonullSquare lattice width. Required for square.Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptionaudioaudio/wav, audio/x-wav, audio/wave, audio/mpeg, audio/ogg, audio/flacnoMono or stereo audio to process — WAV, MP3, OGG or FLAC. Stereo is summed to mono first, since the taps place their own stereo image. The file's own sample rate wins over the sr param.irapplication/jsonnoA previously measured impulse response — an otoc-echo trajectory envelope. Supply it to re-render without paying for the measurement again, and every echo param is ignored. Pass the asset id of a previous retrocausal-echo job's own ir output (output assets carry slot and job_id, so they chain straight into input_files), or upload the JSON yourself. job:&lt;id>/ir is the documented alias for the same thing but may not resolve — prefer the asset id.
Submitting returns 202 Accepted:
```
{

  "job_id": "1b9d6bcd-2e3f-4a5b-8c7d-9e0f1a2b3c4d",

  "status": "queued",

  "submitted_at": "2026-09-08T14:40:02Z"

}

```

Poll job status until completed, then GET /api/v1/jobs/{job_id}/result returns:
```
{

  "outputs": [

    {

      "slot": "result",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345670",

      "filename": "retrocausal-echo-v1-1b9d6bcd-result.wav",

      "content_type": "audio/wav",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    },

    {

      "slot": "ir",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345671",

      "filename": "retrocausal-echo-v1-1b9d6bcd-ir.json",

      "content_type": "application/json",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/ir?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    },

    {

      "slot": "taps",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345672",

      "filename": "retrocausal-echo-v1-1b9d6bcd-taps.json",

      "content_type": "application/json",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/taps?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 7200 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionresultaudio/wav, application/jsonyesThe primary output. With emit: audio (the default) this is the rendered stereo WAV. With emit: map no audio is rendered at all and this is the tap map as JSON — the same envelope the taps slot carries — so a sequencer or plugin can place the events itself without downloading audio.irapplication/jsonyesThe impulse response actually used, as an otoc-echo trajectory envelope. Its output asset chains straight into another job's input_files.ir — one measurement, many mixes.tapsapplication/jsonyesThe full media result envelope: provenance, the audio's shape, the echo summary, the spec, and the rendered tap map (time_ms, level, pan, F, polarity per tap). This is where a caller reads the numbers; a DAW or plugin can load it directly.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_paramsparams fail Params' own field validation (type/range) or a cross-field check (square lattice without width/height, kick_site outside the line, shots over the cap without allow_high_shots).invalid_irthe ir input is not UTF-8 JSON, or not an otoc-echo trajectory envelope. A bare envelope, a handler return wrapped in output, and a whole job result wrapped in result are all accepted.invalid_audiothe audio input could not be decoded as a PCM or float WAV, is over the size cap, or decoded to zero samples.audio_too_longthe input, or the input plus its computed tail, exceeds the render length cap. Set tail_ms explicitly or send a shorter file.no_tapsno tap survived min_level — the echo was fully erased at this theta_x, or min_level is too high. The echo summary is in the message.too_many_tapsthe tap map is larger than the render cap. Raise min_level or lower depth.too_many_qubitsthe delay line needs more qubits than the machine allows — 24 for aer, the device's own width for an IBM backend. Supplying a measured ir sidesteps this entirely.invalid_machinemachine is neither 'aer' nor an IBM backend name the runtime knows.backend_unavailablethe requested execution route could not be reached — for via: direct, qiskit-ibm-runtime is missing or no credentials were supplied (qpu_token param / QISKIT_IBM_TOKEN); for via: mothbackend, the mothbackend package is absent or the service returned a transport error. Retryable.execution_failedthe estimator returned an error while running the echo circuits.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to retrocausal-echo-v1

job = requests.post(f"{API}/engines/retrocausal-echo-v1/process", headers=H,

    json={

        "params": {

            "allow_high_shots": False,

            "decay": 0.9,

            "depth": 8,

            "diffusion_ms": 0,

            "disorder": 0,

            "division": 0.25,

            "emit": "audio",

            "exact": True,

            "feedback": 0,

            "feedback_source": "kick",

            "fractional_gates": True,

            "grain_ms": 120,

            "include_tap_map": True,

            "ir_seconds": 3,

            "kick": "Z",

            "lattice": "chain",

            "machine": "aer",

            "master_ms": 640,

            "max_regen": 24,

            "min_level": 0.05,

            "mix": 0.6,

            "n_sites": 8,

            "negative_mode": "invert",

            "output_format": "pcm_16",

            "shots": 4096,

            "sr": 44100,

            "stereo_width": 1,

            "theta_x": 0.9424777960769379,

            "theta_z": 0,

            "theta_zz": 1.0995574287564276,

            "twirls": 1,

            "via": "direct"

        }

    }).json()

# 2. Poll until terminal

while True:

    st = requests.get(f"{API}/jobs/{job['job_id']}/status", headers=H).json()

    if st["status"] in ("completed", "failed", "cancelled"):

        break

    time.sleep(2)

if st["status"] != "completed":

    raise RuntimeError(f"job {st['status']}: {st['error']}")

# 3. Fetch the result — output slots: result, ir, taps

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:

    Path(out["slot"]).write_bytes(requests.get(out["url"]).content)

```

```
curl -s -X POST https://api.mothquantum.com/api/v1/engines/retrocausal-echo-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "allow_high_shots": false,

    "decay": 0.9,

    "depth": 8,

    "diffusion_ms": 0,

    "disorder": 0,

    "division": 0.25,

    "emit": "audio",

    "exact": true,

    "feedback": 0,

    "feedback_source": "kick",

    "fractional_gates": true,

    "grain_ms": 120,

    "include_tap_map": true,

    "ir_seconds": 3,

    "kick": "Z",

    "lattice": "chain",

    "machine": "aer",

    "master_ms": 640,

    "max_regen": 24,

    "min_level": 0.05,

    "mix": 0.6,

    "n_sites": 8,

    "negative_mode": "invert",

    "output_format": "pcm_16",

    "shots": 4096,

    "sr": 44100,

    "stereo_width": 1,

    "theta_x": 0.9424777960769379,

    "theta_z": 0,

    "theta_zz": 1.0995574287564276,

    "twirls": 1,

    "via": "direct"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
The other half of the split. otoc-echo-v1 is the core engine: it measures a
quantum impulse response and returns it as a typed trajectory. This engine is a
media engine: it turns an impulse response into audio. Both depend on the same
quantum-echo library, so the measurement exists in exactly one place.core   : params -> EchoSpec -> measure_ir -> EchoIR.to_trajectory()
media  : (EchoIR from a library call | a prior job's ir.json) -> MultiTapDelay -> WAVTwo ways in, one renderer:
no ir file  -> this engine calls quantum_echo.measure_ir in-process. One
job, one price, audio out. The QPU work is identical to the core engine's.

an ir file  -> EchoIR.from_trajectory. Re-render a measured response with
different audio, tempo, polarity behaviour or feedback without paying for the
measurement again. The slot is by_reference: true, so it takes either an
upload or job:&lt;id>/ir off a previous retrocausal-echo job.

Nothing here builds a circuit and nothing in render.py knows what a qubit is.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Retrocausal Echo",

    "summary": "A multi-tap delay whose tap map is measured on a quantum computer — negative returns invert, reverse or rotate the signal.",

    "description": "retrocausal-echo-v1 — Retrocausal Echo. A **media** engine.",

    "version": "0.1.2",

    "x-engine-id": "retrocausal-echo-v1",

    "x-engine-version": "0.1.2",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "audio-to-audio"

    ],

    "x-credits-per-run": 2,

    "x-timeout-seconds": 7200,

    "x-registered-at": "2026-09-15T01:31:59Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/retrocausal-echo-v1"

  },

  "servers": [

    {

      "url": "https://api.mothquantum.com",

      "description": "Moth Quantum API"

    }

  ],

  "security": [

    {

      "bearerAuth": []

    }

  ],

  "paths": {

    "/api/v1/engines/retrocausal-echo-v1/process": {

      "post": {

        "operationId": "retrocausal-echo-v1",

        "summary": "Retrocausal Echo",

        "description": "retrocausal-echo-v1 — Retrocausal Echo. A **media** engine.",

        "x-error-codes": [

          {

            "type": "invalid_params",

            "description": "params fail Params' own field validation (type/range) or a cross-field check (square lattice without width/height, kick_site outside the line, shots over the cap without allow_high_shots)."

          },

          {

            "type": "invalid_ir",

            "description": "the `ir` input is not UTF-8 JSON, or not an otoc-echo `trajectory` envelope. A bare envelope, a handler return wrapped in `output`, and a whole job result wrapped in `result` are all accepted."

          },

          {

            "type": "invalid_audio",

            "description": "the `audio` input could not be decoded as a PCM or float WAV, is over the size cap, or decoded to zero samples."

          },

          {

            "type": "audio_too_long",

            "description": "the input, or the input plus its computed tail, exceeds the render length cap. Set tail_ms explicitly or send a shorter file."

          },

          {

            "type": "no_taps",

            "description": "no tap survived min_level — the echo was fully erased at this theta_x, or min_level is too high. The echo summary is in the message."

          },

          {

            "type": "too_many_taps",

            "description": "the tap map is larger than the render cap. Raise min_level or lower depth."

          },

          {

            "type": "too_many_qubits",

            "description": "the delay line needs more qubits than the machine allows — 24 for aer, the device's own width for an IBM backend. Supplying a measured `ir` sidesteps this entirely."

          },

          {

            "type": "invalid_machine",

            "description": "machine is neither 'aer' nor an IBM backend name the runtime knows."

          },

          {

            "type": "backend_unavailable",

            "description": "the requested execution route could not be reached — for `via: direct`, qiskit-ibm-runtime is missing or no credentials were supplied (qpu_token param / QISKIT_IBM_TOKEN); for `via: mothbackend`, the mothbackend package is absent or the service returned a transport error. Retryable."

          },

          {

            "type": "execution_failed",

            "description": "the estimator returned an error while running the echo circuits."

          }

        ],

        "x-output-files": [

          {

            "name": "result",

            "content_types": [

              "audio/wav",

              "application/json"

            ],

            "required": true,

            "description": "The primary output. With `emit: audio` (the default) this is the rendered stereo WAV. With `emit: map` no audio is rendered at all and this is the tap map as JSON — the same envelope the `taps` slot carries — so a sequencer or plugin can place the events itself without downloading audio."

          },

          {

            "name": "ir",

            "content_types": [

              "application/json"

            ],

            "required": true,

            "description": "The impulse response actually used, as an otoc-echo `trajectory` envelope. Its output asset chains straight into another job's `input_files.ir` — one measurement, many mixes."

          },

          {

            "name": "taps",

            "content_types": [

              "application/json"

            ],

            "required": true,

            "description": "The full `media` result envelope: provenance, the audio's shape, the echo summary, the spec, and the rendered tap map (time_ms, level, pan, F, polarity per tap). This is where a caller reads the numbers; a DAW or plugin can load it directly."

          }

        ],

        "tags": [

          "Engine catalog"

        ],

        "security": [

          {

            "bearerAuth": []

          }

        ],

        "requestBody": {

          "required": true,

          "content": {

            "application/json": {

              "schema": {

                "type": "object",

                "properties": {

                  "params": {

                    "properties": {

                      "allow_high_shots": {

                        "default": false,

                        "description": "Permit shots above 8192.",

                        "title": "Allow High Shots",

                        "type": "boolean"

                      },

                      "bpm": {

                        "anyOf": [

                          {

                            "exclusiveMinimum": 20,

                            "maximum": 400,

                            "type": "number"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Tempo. When set, one depth step = `division` of a bar instead of master_ms/depth.",

                        "title": "Bpm"

                      },

                      "decay": {

                        "default": 0.9,

                        "description": "Extra level roll-off per depth step, on top of |F|. 1.0 = none.",

                        "exclusiveMinimum": 0,

                        "maximum": 1,

                        "title": "Decay",

                        "type": "number"

                      },

                      "depth": {

                        "default": 8,

                        "description": "Echo depths t = 1..depth — the tap time slots.",

                        "maximum": 32,

                        "minimum": 1,

                        "title": "Depth",

                        "type": "integer"

                      },

                      "diffusion_ms": {

                        "default": 0,

                        "description": "Square lattice only: y spreads taps by up to ±diffusion_ms/2 inside their depth slot.",

                        "maximum": 500,

                        "minimum": 0,

                        "title": "Diffusion Ms",

                        "type": "number"

                      },

                      "disorder": {

                        "default": 0,

                        "description": "Additive per-gate angle jitter, std in radians. Localises the echo; the only lever that makes `seed` audible.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Disorder",

                        "type": "number"

                      },

                      "division": {

                        "default": 0.25,

                        "description": "Step as a fraction of a beat when bpm is set. 0.25 sixteenth · 0.5 eighth · 0.75 dotted eighth · 0.3333 eighth-triplet · 1.0 quarter.",

                        "exclusiveMinimum": 0,

                        "maximum": 4,

                        "title": "Division",

                        "type": "number"

                      },

                      "emit": {

                        "default": "audio",

                        "description": "`audio` renders a WAV — your input processed, or the effect's own impulse response when no audio is supplied. `map` skips rendering entirely and returns only the time-mapped tap list, which is what a sequencer or a DAW plugin wants: same tap map, no audio work, no WAV to download.",

                        "enum": [

                          "audio",

                          "map"

                        ],

                        "title": "Emit",

                        "type": "string"

                      },

                      "exact": {

                        "default": true,

                        "description": "aer only: exact expectation values instead of sampling.",

                        "title": "Exact",

                        "type": "boolean"

                      },

                      "feedback": {

                        "default": 0,

                        "description": "Regeneration loop gain. The bus of selected taps is normalised first, so this is the fraction of signal that comes back round — always convergent, and 0.6 sounds like 0.6 on a rack unit rather than diverging.",

                        "exclusiveMaximum": 1,

                        "minimum": 0,

                        "title": "Feedback",

                        "type": "number"

                      },

                      "feedback_source": {

                        "default": "kick",

                        "description": "Which taps regenerate. `kick`: only the kick site's column (the classic single regeneration tap). `all`: every tap.",

                        "enum": [

                          "kick",

                          "all"

                        ],

                        "title": "Feedback Source",

                        "type": "string"

                      },

                      "fractional_gates": {

                        "default": true,

                        "description": "Use native rzz/rx where available.",

                        "title": "Fractional Gates",

                        "type": "boolean"

                      },

                      "grain_ms": {

                        "default": 120,

                        "description": "Grain length for `reverse` mode. Short → stuttered; long → whole phrases backwards.",

                        "exclusiveMinimum": 1,

                        "maximum": 2000,

                        "title": "Grain Ms",

                        "type": "number"

                      },

                      "height": {

                        "anyOf": [

                          {

                            "maximum": 32,

                            "minimum": 2,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Square lattice height. Required for `square`.",

                        "title": "Height"

                      },

                      "include_tap_map": {

                        "default": true,

                        "description": "Also emit the rendered tap map inline in the result (it is always written to taps.json).",

                        "title": "Include Tap Map",

                        "type": "boolean"

                      },

                      "ir_seconds": {

                        "default": 3,

                        "description": "With no `audio` input, render the effect's own stereo impulse response for this long.",

                        "exclusiveMinimum": 0,

                        "maximum": 30,

                        "title": "Ir Seconds",

                        "type": "number"

                      },

                      "kick": {

                        "default": "Z",

                        "description": "Perturbation Pauli applied to the kick site between U and U†.",

                        "enum": [

                          "Z",

                          "Y",

                          "X"

                        ],

                        "title": "Kick",

                        "type": "string"

                      },

                      "kick_site": {

                        "anyOf": [

                          {

                            "minimum": 0,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Regeneration source: the site that receives the impulse. Default: centre.",

                        "title": "Kick Site"

                      },

                      "lattice": {

                        "default": "chain",

                        "description": "Delay-line topology. `chain`: site → pan. `square` (Nighthawk-native): x → pan, y → diffusion.",

                        "enum": [

                          "chain",

                          "square"

                        ],

                        "title": "Lattice",

                        "type": "string"

                      },

                      "machine": {

                        "default": "aer",

                        "description": "Backend for the measurement: 'aer' (local, noiseless) or an IBM backend name such as 'ibm_phoenix'.",

                        "title": "Machine",

                        "type": "string"

                      },

                      "master_ms": {

                        "default": 640,

                        "description": "Length of the master delay line in ms. One depth step = master_ms / depth. Ignored when bpm is set.",

                        "exclusiveMinimum": 0,

                        "maximum": 8000,

                        "title": "Master Ms",

                        "type": "number"

                      },

                      "max_regen": {

                        "default": 24,

                        "description": "Cap on regeneration iterations.",

                        "maximum": 64,

                        "minimum": 1,

                        "title": "Max Regen",

                        "type": "integer"

                      },

                      "min_level": {

                        "default": 0.05,

                        "description": "|F| threshold below which a tap is dropped.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Min Level",

                        "type": "number"

                      },

                      "mix": {

                        "default": 0.6,

                        "description": "Dry/wet. 0 = dry, 1 = wet only.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Mix",

                        "type": "number"

                      },

                      "n_sites": {

                        "default": 8,

                        "description": "Chain length in qubits (= pan positions). Ignored for `square`.",

                        "maximum": 156,

                        "minimum": 2,

                        "title": "N Sites",

                        "type": "integer"

                      },

                      "negative_mode": {

                        "default": "invert",

                        "description": "What a negative F does. `invert`: flip polarity (phase-cancelling echo). `reverse`: play that tap's grains backwards. `phase`: rotate by arg(F) via a Hilbert transform — the only mode that uses F_im, so pair it with theta_z > 0.",

                        "enum": [

                          "invert",

                          "reverse",

                          "phase"

                        ],

                        "title": "Negative Mode",

                        "type": "string"

                      },

                      "output_format": {

                        "default": "pcm_16",

                        "description": "WAV sample format.",

                        "enum": [

                          "pcm_16",

                          "pcm_32",

                          "float_32"

                        ],

                        "title": "Output Format",

                        "type": "string"

                      },

                      "qpu_instance": {

                        "anyOf": [

                          {

                            "type": "string"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "IBM Quantum instance CRN. As with the token: required for `via: direct`, optional BYOK for `via: mothbackend`.",

                        "format": "password",

                        "title": "Qpu Instance",

                        "writeOnly": true

                      },

                      "qpu_token": {

                        "anyOf": [

                          {

                            "type": "string"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "IBM Quantum API token when machine is an IBM backend; falls back to QISKIT_IBM_TOKEN.",

                        "format": "password",

                        "title": "Qpu Token",

                        "writeOnly": true

                      },

                      "ref_floor": {

                        "anyOf": [

                          {

                            "exclusiveMinimum": 0,

                            "maximum": 1,

                            "type": "number"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "|c_ref| below which a tap is dropped as unnormalisable. Default: 4/sqrt(shots), ~0 for exact simulation. Raise it to prune taps the noise floor cannot support.",

                        "title": "Ref Floor"

                      },

                      "seed": {

                        "anyOf": [

                          {

                            "maximum": 9007199254740991,

                            "minimum": 0,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "RNG seed for the disorder realisation. Only audible when disorder > 0. Drawn as a 31-bit integer and returned in provenance if omitted. Capped at 2**53-1: above that, moth-api (Go) and any browser client re-spell the integer as a float64 and it stops matching the seed you sent.",

                        "title": "Seed"

                      },

                      "shots": {

                        "default": 4096,

                        "description": "Shots per circuit. Ignored when machine='aer' and exact=true. Above 8192 requires allow_high_shots.",

                        "minimum": 1,

                        "title": "Shots",

                        "type": "integer"

                      },

                      "sr": {

                        "default": 44100,

                        "description": "Sample rate. Ignored when an `audio` file is supplied — that file's own rate is used.",

                        "maximum": 192000,

                        "minimum": 8000,

                        "title": "Sr",

                        "type": "integer"

                      },

                      "stereo_width": {

                        "default": 1,

                        "description": "Scales the site → pan spread. 0 = mono.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Stereo Width",

                        "type": "number"

                      },

                      "tail_ms": {

                        "anyOf": [

                          {

                            "maximum": 30000,

                            "minimum": 0,

                            "type": "number"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Silence appended to the input so the last tap and its regenerations fit. Default: computed from the tap map.",

                        "title": "Tail Ms"

                      },

                      "theta_x": {

                        "default": 0.9424777960769379,

                        "description": "Transverse kick per layer (RX, rad) — the 'how quantum' dial. Low → loud regular taps; high → inverted, attenuated, erased.",

                        "maximum": 3.141592653589793,

                        "minimum": 0,

                        "title": "Theta X",

                        "type": "number"

                      },

                      "theta_z": {

                        "default": 0,

                        "description": "Phase layer (RZ, rad). 0 → real, two-signed taps. >0 → complex F, which `negative_mode: phase` renders as rotation.",

                        "maximum": 3.141592653589793,

                        "minimum": 0,

                        "title": "Theta Z",

                        "type": "number"

                      },

                      "theta_zz": {

                        "default": 1.0995574287564276,

                        "description": "Coupling per layer (RZZ, rad). Non-monotonic: ≈0.25π is the sparse setting. π is a Clifford (no scrambling). θ and π−θ coincide only when theta_x = 0, not at the default drive, so the upper half of the range is its own territory. The sign is invisible unless theta_z > 0.",

                        "exclusiveMinimum": -3.141592653589793,

                        "maximum": 3.141592653589793,

                        "title": "Theta Zz",

                        "type": "number"

                      },

                      "twirls": {

                        "default": 1,

                        "description": "ZZ-commutant Pauli twirls per circuit, averaged. Only useful on hardware: it randomises off-axis coherent error in the couplings. Multiplies the circuit count, so it multiplies QPU time.",

                        "maximum": 32,

                        "minimum": 1,

                        "title": "Twirls",

                        "type": "integer"

                      },

                      "via": {

                        "default": "direct",

                        "description": "How to reach the machine. `direct`: this engine drives qiskit-ibm-runtime itself (analytic emulation, native fractional gates, one batched QPU session). `mothbackend`: route through Moth's execution service, which holds the credentials — sampled only, so no analytic mode, no fractional gates, and one submission per circuit.",

                        "enum": [

                          "direct",

                          "mothbackend"

                        ],

                        "title": "Via",

                        "type": "string"

                      },

                      "width": {

                        "anyOf": [

                          {

                            "maximum": 32,

                            "minimum": 2,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Square lattice width. Required for `square`.",

                        "title": "Width"

                      }

                    },

                    "title": "Params",

                    "type": "object",

                    "description": "Engine parameters, validated against this schema."

                  },

                  "input_files": {

                    "type": "object",

                    "description": "Input slot name → id of an uploaded asset you own.",

                    "properties": {

                      "audio": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Mono or stereo audio to process — WAV, MP3, OGG or FLAC. Stereo is summed to mono first, since the taps place their own stereo image. The file's own sample rate wins over the `sr` param. Accepts: audio/wav, audio/x-wav, audio/wave, audio/mpeg, audio/ogg, audio/flac."

                      },

                      "ir": {

                        "type": "string",

                        "format": "uuid",

                        "description": "A previously measured impulse response — an otoc-echo `trajectory` envelope. Supply it to re-render without paying for the measurement again, and every echo param is ignored. Pass the asset id of a previous retrocausal-echo job's own `ir` output (output assets carry `slot` and `job_id`, so they chain straight into `input_files`), or upload the JSON yourself. `job:<id>/ir` is the documented alias for the same thing but may not resolve — prefer the asset id. Accepts: application/json."

                      }

                    },

                    "required": []

                  }

                },

                "required": [

                  "params"

                ],

                "additionalProperties": false

              }

            }

          }

        },

        "responses": {

          "202": {

            "description": "Job accepted. Poll `GET /jobs/{job_id}/status`.",

            "content": {

              "application/json": {

                "schema": {

                  "$ref": "#/components/schemas/JobAccepted"

                }

              }

            }

          },

          "401": {

            "description": "Unauthorized",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          },

          "404": {

            "description": "Not found — no such engine, or not visible to you",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          },

          "422": {

            "description": "Params or input files rejected; every violation is listed in `errors[]`",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          },

          "429": {

            "description": "Rate limited (300 requests/minute per key)",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          },

          "503": {

            "description": "Job runtime unavailable; retry with backoff",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          }

        },

        "x-codeSamples": [

          {

            "lang": "bash",

            "label": "curl",

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/retrocausal-echo-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"allow_high_shots\": false,\n    \"decay\": 0.9,\n    \"depth\": 8,\n    \"diffusion_ms\": 0,\n    \"disorder\": 0,\n    \"division\": 0.25,\n    \"emit\": \"audio\",\n    \"exact\": true,\n    \"feedback\": 0,\n    \"feedback_source\": \"kick\",\n    \"fractional_gates\": true,\n    \"grain_ms\": 120,\n    \"include_tap_map\": true,\n    \"ir_seconds\": 3,\n    \"kick\": \"Z\",\n    \"lattice\": \"chain\",\n    \"machine\": \"aer\",\n    \"master_ms\": 640,\n    \"max_regen\": 24,\n    \"min_level\": 0.05,\n    \"mix\": 0.6,\n    \"n_sites\": 8,\n    \"negative_mode\": \"invert\",\n    \"output_format\": \"pcm_16\",\n    \"shots\": 4096,\n    \"sr\": 44100,\n    \"stereo_width\": 1,\n    \"theta_x\": 0.9424777960769379,\n    \"theta_z\": 0,\n    \"theta_zz\": 1.0995574287564276,\n    \"twirls\": 1,\n    \"via\": \"direct\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to retrocausal-echo-v1\njob = requests.post(f\"{API}/engines/retrocausal-echo-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"allow_high_shots\": False,\n            \"decay\": 0.9,\n            \"depth\": 8,\n            \"diffusion_ms\": 0,\n            \"disorder\": 0,\n            \"division\": 0.25,\n            \"emit\": \"audio\",\n            \"exact\": True,\n            \"feedback\": 0,\n            \"feedback_source\": \"kick\",\n            \"fractional_gates\": True,\n            \"grain_ms\": 120,\n            \"include_tap_map\": True,\n            \"ir_seconds\": 3,\n            \"kick\": \"Z\",\n            \"lattice\": \"chain\",\n            \"machine\": \"aer\",\n            \"master_ms\": 640,\n            \"max_regen\": 24,\n            \"min_level\": 0.05,\n            \"mix\": 0.6,\n            \"n_sites\": 8,\n            \"negative_mode\": \"invert\",\n            \"output_format\": \"pcm_16\",\n            \"shots\": 4096,\n            \"sr\": 44100,\n            \"stereo_width\": 1,\n            \"theta_x\": 0.9424777960769379,\n            \"theta_z\": 0,\n            \"theta_zz\": 1.0995574287564276,\n            \"twirls\": 1,\n            \"via\": \"direct\"\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — output slots: result, ir, taps\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/retrocausal-echo-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"allow_high_shots\": false,\n      \"decay\": 0.9,\n      \"depth\": 8,\n      \"diffusion_ms\": 0,\n      \"disorder\": 0,\n      \"division\": 0.25,\n      \"emit\": \"audio\",\n      \"exact\": true,\n      \"feedback\": 0,\n      \"feedback_source\": \"kick\",\n      \"fractional_gates\": true,\n      \"grain_ms\": 120,\n      \"include_tap_map\": true,\n      \"ir_seconds\": 3,\n      \"kick\": \"Z\",\n      \"lattice\": \"chain\",\n      \"machine\": \"aer\",\n      \"master_ms\": 640,\n      \"max_regen\": 24,\n      \"min_level\": 0.05,\n      \"mix\": 0.6,\n      \"n_sites\": 8,\n      \"negative_mode\": \"invert\",\n      \"output_format\": \"pcm_16\",\n      \"shots\": 4096,\n      \"sr\": 44100,\n      \"stereo_width\": 1,\n      \"theta_x\": 0.9424777960769379,\n      \"theta_z\": 0,\n      \"theta_zz\": 1.0995574287564276,\n      \"twirls\": 1,\n      \"via\": \"direct\"\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: result, ir, taps\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

          }

        ]

      }

    }

  },

  "components": {

    "securitySchemes": {

      "bearerAuth": {

        "type": "http",

        "scheme": "bearer",

        "description": "A moth_ API key from the dashboard."

      }

    },

    "schemas": {

      "JobAccepted": {

        "type": "object",

        "required": [

          "job_id",

          "status",

          "submitted_at"

        ],

        "properties": {

          "job_id": {

            "type": "string"

          },

          "status": {

            "type": "string",

            "enum": [

              "queued"

            ]

          },

          "submitted_at": {

            "type": "string",

            "format": "date-time"

          }

        }

      },

      "Problem": {

        "type": "object",

        "properties": {

          "title": {

            "type": "string"

          },

          "status": {

            "type": "integer"

          },

          "detail": {

            "type": "string"

          },

          "errors": {

            "type": "array",

            "items": {

              "type": "object",

              "properties": {

                "location": {

                  "type": "string"

                },

                "message": {

                  "type": "string"

                },

                "value": {}

              }

            }

          }

        }

      }

    }

  }

}

```

Related engines​

QRC Audio — qrc-audio-v1, Audio → Audio

QRC Generate — qrc-gen-v2, File → JSON

QRC MIDI — qrc-midi-v1, Audio → Audio

QDrive — qdrive-api-v1, Text → Text

