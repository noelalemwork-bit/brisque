// Voice chat: a WebRTC audio mesh between everyone in the room, signalled through the Room Durable
// Object (`signal` messages). The lower seat of each pair makes the offer. Levels (0..1) for every
// speaker, including yourself, go to onLevel(seat, level), which drives the avatar ripples. Voice is opt-in
// (enable() asks for the mic). Muting someone silences their playback only: their level keeps flowing, so
// the ripples still show when they talk. Muting yourself stops your outgoing audio (your own level still shows).

const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];

export function createVoice(room, { onLevel = () => {} } = {}) {
  const peers = new Map(); // seat -> { pc, audio, analyser, state }
  let local = null;
  let localAnalyser = null;
  let ctx = null;
  let muted = false;
  let timer = null;
  let enabled = false;
  const mutedPeers = new Set(); // room seats we don't want to hear

  const send = (to, data) => room.send({ t: 'signal', to, data });

  function analyserFor(stream) {
    ctx ??= new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const a = ctx.createAnalyser();
    a.fftSize = 512;
    src.connect(a);
    return a;
  }
  const levelOf = (a) => {
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    return Math.min(1, Math.sqrt(sum / buf.length) * 6);
  };

  function peer(seat) {
    if (peers.has(seat)) return peers.get(seat);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const entry = { pc, audio: null, analyser: null, state: 'new' };
    peers.set(seat, entry);
    for (const track of local.getTracks()) pc.addTrack(track, local);
    pc.onicecandidate = (e) => { if (e.candidate) send(seat, { type: 'candidate', candidate: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { entry.state = pc.connectionState; };
    pc.ontrack = (e) => {
      const audio = new Audio();
      audio.srcObject = e.streams[0];
      audio.autoplay = true;
      audio.muted = mutedPeers.has(seat);
      audio.play().catch(() => {});
      entry.audio = audio;
      entry.analyser = analyserFor(e.streams[0]);
    };
    return entry;
  }

  async function call(seat) {
    const { pc } = peer(seat);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send(seat, { type: 'offer', sdp: pc.localDescription.toJSON() });
  }

  room.on('signal', async ({ from, data }) => {
    if (!enabled) return;
    if (data.type === 'voice-on') {
      if (room.seat < from) call(from);
      else if (!data.reply) send(from, { type: 'voice-on', reply: true });
      return;
    }
    const { pc } = peer(from);
    if (data.type === 'offer') {
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send(from, { type: 'answer', sdp: pc.localDescription.toJSON() });
    } else if (data.type === 'answer') {
      await pc.setRemoteDescription(data.sdp);
    } else if (data.type === 'candidate') {
      await pc.addIceCandidate(data.candidate).catch(() => {});
    } else if (data.type === 'voice-off') {
      drop(from);
    }
  });

  function drop(seat) {
    const p = peers.get(seat);
    if (!p) return;
    p.pc.close();
    p.audio?.pause();
    peers.delete(seat);
    onLevel(seat, 0);
  }

  return {
    get enabled() { return enabled; },
    get muted() { return muted; },
    async enable() {
      if (enabled) return;
      local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      localAnalyser = analyserFor(local);
      enabled = true;
      for (const p of room.peers) if (p.seat !== room.seat && p.online) send(p.seat, { type: 'voice-on' });
      timer = setInterval(() => {
        onLevel(room.seat, levelOf(localAnalyser));
        for (const [seat, p] of peers) if (p.analyser) onLevel(seat, levelOf(p.analyser));
      }, 60);
    },
    setMuted(m) { muted = m; for (const t of local?.getAudioTracks() ?? []) t.enabled = !m; },
    isPeerMuted: (seat) => mutedPeers.has(seat),
    setPeerMuted(seat, m) {
      if (m) mutedPeers.add(seat); else mutedPeers.delete(seat);
      const p = peers.get(seat);
      if (p?.audio) p.audio.muted = m;
    },
    // for tests / the lobby: per-peer connection state and last levels
    status() { return { enabled, muted, peers: Object.fromEntries([...peers].map(([s, p]) => [s, { state: p.state, level: p.analyser ? levelOf(p.analyser) : 0, muted: mutedPeers.has(s), playbackMuted: !!p.audio?.muted }])) }; },
    disable() {
      if (!enabled) return;
      for (const seat of [...peers.keys()]) { send(seat, { type: 'voice-off' }); drop(seat); }
      for (const t of local?.getTracks() ?? []) t.stop();
      clearInterval(timer);
      onLevel(room.seat, 0);
      enabled = false;
    },
  };
}
