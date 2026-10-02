"use client";

/**
 * Yeni sipariş zili.
 *
 * Ses dosyası yerine Web Audio ile sentezlenir: ek varlık indirilmez,
 * gecikme sıfıra yakındır ve mutfak tabletinde çevrimdışı da çalışır.
 *
 * Tarayıcılar sesi ancak bir kullanıcı hareketinden sonra başlatır; bu
 * yüzden panel "Sesi aç" düğmesiyle `unlock()` çağırır (gerçek hayatta da
 * vardiya başında tablette sesi açmak bir alışkanlıktır).
 */

type Ctor = typeof AudioContext;

let context: AudioContext | null = null;
let alarmTimer: ReturnType<typeof setInterval> | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctx: Ctor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctx) return null;
  context = new Ctx();
  return context;
}

/** Kullanıcı hareketinden sonra çağrılır; ses motorunu açar. */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === "running";
}

export function audioReady(): boolean {
  return context?.state === "running";
}

/** Tek bir çan vuruşu. */
function strike(frequency: number, startAt: number, duration = 0.55) {
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  // Üst harmonik — düz sinüs yerine gerçek çan tınısı verir
  const harmonic = ctx.createOscillator();
  const harmonicGain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = frequency;
  harmonic.type = "sine";
  harmonic.frequency.value = frequency * 2.76;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.32, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  harmonicGain.gain.setValueAtTime(0.0001, startAt);
  harmonicGain.gain.exponentialRampToValueAtTime(0.09, startAt + 0.008);
  harmonicGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration * 0.6);

  osc.connect(gain).connect(ctx.destination);
  harmonic.connect(harmonicGain).connect(ctx.destination);

  osc.start(startAt);
  harmonic.start(startAt);
  osc.stop(startAt + duration + 0.05);
  harmonic.stop(startAt + duration + 0.05);
}

/** "Ding-dong" — yeni sipariş bildirimi. */
export function playChime(): void {
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  strike(988, now);
  strike(740, now + 0.24, 0.8);
}

/** Onay bekleyen sipariş varken 5 saniyede bir çalar. */
export function startAlarm(): void {
  if (alarmTimer) return;
  playChime();
  alarmTimer = setInterval(playChime, 5000);
}

export function stopAlarm(): void {
  if (!alarmTimer) return;
  clearInterval(alarmTimer);
  alarmTimer = null;
}

export function alarmRunning(): boolean {
  return alarmTimer !== null;
}
