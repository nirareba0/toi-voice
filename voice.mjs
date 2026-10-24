// 声を聞きやすくする（T33）: 再生の速さ・聞く位置・録音中の波形の計算。画面（app.mjs）は DOM だけを受け持つ。
// 文字起こしはしない（AIOS DECISIONS 2026-10-24）。声の中身は端末の中でだけ扱い、どこにも送らない。

// 再生の速さ。押すたびに次へ。選んだ速さは、この端末に覚えておく（サーバーには送らない）
export const SPEEDS = [1, 1.5];
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
