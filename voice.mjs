// 声を聞きやすくする（T33）: 再生の速さ・聞く位置・録音中の波形の計算。画面（app.mjs）は DOM だけを受け持つ。
// 文字起こしはしない（AIOS DECISIONS 2026-10-24）。声の中身は端末の中でだけ扱い、どこにも送らない。

// 再生の速さ。押すたびに次へ。選んだ速さは、この端末に覚えておく（サーバーには送らない）
export const SPEEDS = [1, 1.5, 2];
export const SPEED_KEY = 'toi-voice-speed';
export const nextSpeed = (r) => SPEEDS[(SPEEDS.indexOf(r) + 1) % SPEEDS.length];
export const pickSpeed = (stored) => (SPEEDS.includes(Number(stored)) ? Number(stored) : SPEEDS[0]);

// 0:42 の形（聞く位置と長さ）
export function clock(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// 声の長さ。録音した端末の webm は長さが入っていない（Infinity）ことがあるので、そのときは記録の秒数を使う
export const lengthOf = (mediaDuration, recordedSec) =>
  (Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : Math.max(0, Number(recordedSec) || 0));

// 聞く位置（つまみの値）を、0〜長さの中に収める
export const seekTo = (value, length) => Math.min(Math.max(0, Number(value) || 0), Math.max(0, length));

// 録音中の波形: AnalyserNode の getByteTimeDomainData（128 が無音）から、その瞬間の大きさを 0〜1 で
export function levelOf(bytes) {
  if (!bytes?.length) return 0;
  let sum = 0;
  for (const b of bytes) sum += ((b - 128) / 128) ** 2;
  // 話し声の RMS はおおむね 0.3 までなので、見やすいように広げる
  return Math.min(1, Math.sqrt(sum / bytes.length) * 3);
}

// 大きさの履歴（右が新しい）。count 本を超えたら古いものから落とす
export function pushLevel(history, level, count) {
  const next = [...history, level];
  return next.length > count ? next.slice(next.length - count) : next;
}

// 聞くときの波形（2026-10-25 UI を磨く）: 中身からは作らず、声の id から決まる飾りの形（同じ声はいつも同じ形）。
// 本物の波形を作るには音声を全部読む必要があり、聞く前に通信が増えるのでしない
export function waveOf(seed, count) {
  let x = 2166136261;
  for (const ch of String(seed ?? '')) x = Math.imul(x ^ ch.codePointAt(0), 16777619) >>> 0;
  const out = [];
  for (let i = 0; i < count; i++) {
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
    // 話し声らしく、端は低く・まん中は高めに
    const edge = Math.sin(Math.PI * (i + 0.5) / count);
    out.push(Math.round((0.25 + 0.75 * edge * ((x % 1000) / 1000)) * 100) / 100);
  }
  return out;
}

// 人ごとの色（アバターと波形を同じ色にして、名前を読まなくても誰の声か分かる）。style.css の --p0〜--p7
export const TONES = 8;
export function toneOf(name) {
  let x = 0;
  for (const ch of String(name ?? '')) x = (x * 31 + ch.codePointAt(0)) >>> 0;
  return x % TONES;
}
