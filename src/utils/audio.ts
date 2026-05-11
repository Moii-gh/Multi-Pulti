type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const createAudioContext = () => {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as WindowWithWebkitAudio).webkitAudioContext;

  return AudioContextClass ? new AudioContextClass() : null;
};

let audioCtx: AudioContext | null = null;

function playTone(freq: number, type: OscillatorType, duration: number) {
  if (!audioCtx) audioCtx = createAudioContext();
  if (!audioCtx) return;
  
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export const playPop = () => playTone(800, 'sine', 0.1);
export const playSwoosh = () => playTone(300, 'triangle', 0.15);
export const playAction = () => playTone(600, 'square', 0.1);
export const playError = () => playTone(150, 'sawtooth', 0.3);
