let audioCtx: AudioContext | null = null;
let initialized = false;

function ensureAudioContext() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  return audioCtx;
}

export function initNotificationAudio() {
  if (initialized) return;
  initialized = true;

  const unlock = async () => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

export function playNotificationTone(kind: "chime" | "beep" | "ding" = "chime") {
  try {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.connect(ctx.destination);

    const notes =
      kind === "beep"
        ? [700, 700]
        : kind === "ding"
          ? [880, 660]
          : [523.25, 659.25, 783.99];
    let t = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(gain);
      gain.connect(master);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

      osc.start(t);
      osc.stop(t + 0.24);
      t += i === 1 ? 0.1 : 0.08;
    });

    master.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
  } catch {
    // Ignore if browser blocks audio context or autoplay
  }
}
