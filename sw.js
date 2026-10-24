// service worker（T32）: 画面のファイルを手元に置いて、2回目から画面を速く開く。
// 持つのは同じサイトの画面のファイル（html・css・mjs・アイコン・manifest）だけ。
// ノートの中身（/api/・音声・Supabase への問い合わせ）は持たず、いつも通信に任せる。端末に中身が残らないように。
// 開き方: 手元にあれば先に出し、裏で新しい版を取ってきて置き換える（次に開いたときに新しい版になる）。
// 画面を大きく変えたら CACHE の版を上げる（古い置き場は activate で消える）。
const CACHE = 'toi-voice-shell-2026-10-24-2';
const SHELL = [
  './', 'index.html', 'style.css', 'app.mjs', 'i18n.mjs', 'consent.mjs', 'diary-promise.mjs', 'limit.mjs', 'voice.mjs',
  'backend.mjs', 'backend-local.mjs', 'backend-supabase.mjs',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-180.png',
];
const SHELL_FILE = /\.(html|css|mjs|js|svg|png|webmanifest)$/;

// 画面のファイルか。/api/ と音声は入れない
function isShell(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.includes('/api/')) return false;
  const last = url.pathname.split('/').pop();
  return last === '' || last === 'join' || SHELL_FILE.test(last);
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    // 1つ取れなくても（試作とページ版でファイルが違う）ほかは置く
    Promise.allSettled(SHELL.map((p) => cache.add(new URL(p, self.registration.scope))))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('toi-voice-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!isShell(url)) return; // 通信に任せる
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    });
    if (hit) {
      event.waitUntil(fresh.catch(() => {}));
      return hit;
    }
    return fresh;
  }));
});
