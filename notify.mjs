// 通知（T36・work/notify-setup.md）: 「ホーム画面に置く → 開く → 通知を許可」のチュートリアルと、Web Push の購読。
// 公開の鍵は、Supabase 版では関数 push_public_key から読む（Edge Function が最初に動いたときに作る・2026-10-25）。meta はローカルの試し用
// 画面（app.mjs）から使う。ブラウザの道具（navigator・Notification・service worker）は引数で受け取り、テストで偽物に差し替える。
// 通知に載せるのは「あなたの番です」「余白が付きました」だけ。書き手の名前・ページの言葉・順番は載せない（D-2・D-3。ロック画面で人に見える）。
// 公開の鍵（VAPID）は index.html の meta に置く（公開してよい鍵）。秘密の鍵は Supabase の Secrets にだけ置き、画面にもファイルにも書かない。

export const VAPID_META = 'toi-voice-vapid-public-key';

// チュートリアルの3枚（機種ごと）。文は i18n.mjs の UI の notifySteps[機種][i]、絵は public/ の svg
export const TUTORIAL = {
  ios: ['tut-ios-add.svg', 'tut-open.svg', 'tut-allow.svg'],
  android: ['tut-android-add.svg', 'tut-open.svg', 'tut-allow.svg'],
};
export const PLATFORMS = Object.keys(TUTORIAL);

// 機種を見分ける。Android でなければ iPhone の手順を先に出す（社内で多い。PC でも切り替えて読める）
export const platformOf = (userAgent = '') => (/android/i.test(userAgent) ? 'android' : 'ios');
// iPad の Safari は Mac のふりをするので、触れる点の数で見る
const isIos = (ua = '', touch = 0) => /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && touch > 1);

// ホーム画面のアイコンから開いたか（iPhone は navigator.standalone、ほかは display-mode）
export function isStandalone(win) {
  try {
    if (win.navigator?.standalone === true) return true;
    return !!win.matchMedia?.('(display-mode: standalone)').matches;
  } catch { return false; }
}

// 公開の鍵（base64url）を、subscribe() に渡す形（Uint8Array）にする
export function keyToBytes(base64url) {
  const s = String(base64url ?? '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('通知の鍵の形が正しくありません');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  // P-256 の公開鍵は 65 バイト（先頭が 4）
  if (out.length !== 65 || out[0] !== 4) throw new Error('通知の鍵の形が正しくありません');
  return out;
}

// いまの状態: unsupported（この端末では受け取れない）・needs-home（iPhone でホーム画面から開いていない）・
// no-key（公開の鍵がまだ無い）・denied（端末の設定で止めてある）・on（届く）・off（まだ）
export async function pushState({ win, publicKey }) {
  const nav = win.navigator ?? {};
  const ios = isIos(nav.userAgent, nav.maxTouchPoints);
  if (ios && !isStandalone(win)) return 'needs-home';
  if (!nav.serviceWorker || !win.PushManager || !win.Notification) return 'unsupported';
  if (!publicKey) return 'no-key';
  if (win.Notification.permission === 'denied') return 'denied';
  try {
    const reg = await nav.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub && win.Notification.permission === 'granted' ? 'on' : 'off';
  } catch { return 'off'; }
}

// 保存の層に渡す形。endpoint は https だけ、鍵は base64url だけ（store.mjs・schema.sql の save_push も同じ決まりで確かめる）
export function subscriptionInput(json, lang = 'ja') {
  const endpoint = String(json?.endpoint ?? '');
  const p256dh = String(json?.keys?.p256dh ?? '');
  const auth = String(json?.keys?.auth ?? '');
  if (!/^https:\/\/\S+$/.test(endpoint) || endpoint.length > 1000) throw new Error('通知の宛先が正しくありません');
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{1,100}$/.test(auth)) throw new Error('通知の鍵の形が正しくありません');
  return { endpoint, p256dh, auth, lang: lang === 'en' ? 'en' : 'ja' };
}

// 「通知を受け取る」を押したとき（ボタンの操作の中で呼ぶ。iPhone は操作の外で許可を聞けない）
export async function turnOn({ win, publicKey, save, lang }) {
  const permission = await win.Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await win.navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  try {
    await save(subscriptionInput(sub.toJSON(), lang));
  } catch (err) {
    await sub.unsubscribe().catch(() => {}); // 保存できなければ、端末の購読も残さない
    throw err;
  }
  return 'on';
}

// 「通知をやめる」: 保存の層から消してから、端末の購読も外す
export async function turnOff({ win, remove }) {
  const reg = await win.navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return 'off';
  await remove(sub.endpoint);
  await sub.unsubscribe().catch(() => {});
  return 'off';
}

// 通知の文（sw.js にも同じ文を置く。service worker は module で読み込まない端末があるため。test/notify.test.mjs が突き合わせる）
export const PUSH_TEXT = {
  ja: { title: '問いと声', turn: 'あなたの番です', margin: 'あなたのページに余白が付きました', prompt: '新しい問いが届きました', reply: 'あなたの声に返事が届きました' },
  en: { title: 'Toi Voice', turn: "It's your turn", margin: 'Someone wrote in the margin of your page', prompt: 'A new question is here', reply: 'Someone replied to your voice' },
};
// 通知の中身（送る側が作る）。種類と言語だけ。名前・問いの言葉・ページの言葉・順番は入れない。
// prompt（新しい問いが開いた）・reply（自分の声に返事が付いた）は声のログ版（2026-10-25）。印（それ知らなかった）は知らせない
export const PUSH_KINDS = ['turn', 'margin', 'prompt', 'reply'];
export function pushPayload(kind, lang) {
  if (!PUSH_KINDS.includes(kind)) throw new Error(`通知の種類が正しくありません: ${kind}`);
  return JSON.stringify({ kind, lang: lang === 'en' ? 'en' : 'ja' });
}
// 届いた中身から、出す文と開く画面を決める（sw.js と同じ決まり）
export function noticeFor(data) {
  const lang = data?.lang === 'en' ? 'en' : 'ja';
  const kind = PUSH_KINDS.includes(data?.kind) ? data.kind : 'turn';
  return { title: PUSH_TEXT[lang].title, body: PUSH_TEXT[lang][kind], open: kind === 'turn' ? '#/write' : '#/' };
}
