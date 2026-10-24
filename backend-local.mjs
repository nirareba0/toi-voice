// 画面の保存の層（ローカル版）: 試作のサーバー（src/server.mjs）に fetch で頼む。
// Supabase 版（backend-supabase.mjs）と同じ名前の関数を持つ（BACKEND_METHODS・test/backend.test.mjs が突き合わせる）。

// シーズン制（mvp-spec §0）で足した関数。Supabase 版はまだ schema.sql に無いので、呼ぶと断る（T19 の次）
export const SEASON_METHODS = ['swapNomination', 'keepList', 'setKeep', 'setShare', 'collection'];

// 交換日記版（mvp-spec §7）で足した関数。Supabase 版は schema.sql の D-1〜D-6 の関数を呼ぶ（T28）
export const DIARY_METHODS = ['inviteInfo', 'renewInvite', 'notebook', 'drawCards', 'writePage', 'skipTurn', 'resumeTurns',
  'page', 'deletePage', 'setPageKeep', 'margin', 'deleteMargin', 'setMarginInBook', 'books', 'book'];

// 通知（T36・notify.mjs）: Web Push の購読を保存する・消す。中身は { endpoint, p256dh, auth, lang } だけ
export const NOTIFY_METHODS = ['savePush', 'deletePush'];

export const BACKEND_METHODS = [
  'join', 'me', 'rename', 'leave', 'prompts', 'prompt', 'answer', 'deleteVoice',
  'reply', 'deleteReply', 'audioUrl', 'final', 'answerFinal', 'deleteFinal',
  ...SEASON_METHODS, ...DIARY_METHODS, ...NOTIFY_METHODS,
];

export function localBackend({ fetch = globalThis.fetch.bind(globalThis), base = '' } = {}) {
  async function api(path, { method = 'GET', json, audio } = {}) {
    const headers = { 'x-toi-voice': '1' };
    let body;
    if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
    if (audio) { headers['content-type'] = audio.blob.type; headers['x-duration'] = String(audio.durationSec); body = audio.blob; }
    const res = await fetch(`${base}${path}`, { method, headers, body, credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error ?? 'うまくいきませんでした'), { status: res.status });
    return data;
  }
  // 答え・返事の中身: { kind: 'text', text } ／ { kind: 'pass' } ／ { kind: 'mark' } ／ { kind: 'voice', audio: { blob, durationSec } }
  const send = (path, input) => (input.kind === 'voice'
    ? api(path, { method: 'POST', audio: input.audio })
    : api(path, { method: 'POST', json: { kind: input.kind, text: input.text } }));

  return {
    join: ({ invite, displayName, consent, consentLang, promise }) => api('/api/join', { method: 'POST', json: { invite, displayName, consent, consentLang, promise } }),
    me: () => api('/api/me'),
    rename: (displayName) => api('/api/me/name', { method: 'POST', json: { displayName } }),
    leave: () => api('/api/me', { method: 'DELETE' }),
    prompts: () => api('/api/prompts'),
    prompt: (id) => api(`/api/prompts/${id}`),
    answer: (promptId, input) => send(`/api/prompts/${promptId}/answer`, input),
    deleteVoice: (id) => api(`/api/voices/${id}`, { method: 'DELETE' }),
    // promptId は Supabase 版が音声の置き場所に使う。ローカル版では使わない
    reply: (voiceId, input, { promptId } = {}) => send(`/api/voices/${voiceId}/replies`, input),
    deleteReply: (id) => api(`/api/replies/${id}`, { method: 'DELETE' }),
    // 音声はサーバーが毎回「答えたか」を確かめて渡す
    audioUrl: async (kind, item) => `${base}/api/audio/${kind}/${item.id}`,
    final: () => api('/api/final'),
    answerFinal: ({ continueChoice, payFor, note }) => api('/api/final', { method: 'POST', json: { continueChoice, payFor, note } }),
    deleteFinal: () => api('/api/final', { method: 'DELETE' }),
    swapNomination: (promptId) => api(`/api/prompts/${promptId}/swap`, { method: 'POST', json: {} }),
    keepList: () => api('/api/keep'),
    setKeep: (voiceId, keep) => api(`/api/voices/${voiceId}/keep`, { method: 'POST', json: { keep } }),
    setShare: (voiceId, share) => api(`/api/voices/${voiceId}/share`, { method: 'POST', json: { share } }),
    collection: async () => (await api('/api/collection')).collection,
    inviteInfo: (invite) => api('/api/invite', { method: 'POST', json: { invite } }),
    renewInvite: () => api('/api/notebook/invite', { method: 'POST', json: {} }),
    notebook: () => api('/api/notebook'),
    drawCards: () => api('/api/notebook/cards'),
    // ページの中身は答えと同じ形。カード・「前のページに続ける」・見出しは URL の ? で渡す（声のときも同じ）
    writePage: (input, { cardId = null, follows = false, title = null } = {}) => send(`/api/notebook/pages?${new URLSearchParams({ card: cardId ?? '', follows: follows ? '1' : '', title: title ?? '' })}`, input),
    skipTurn: () => api('/api/notebook/skip', { method: 'POST', json: {} }),
    resumeTurns: () => api('/api/notebook/resume', { method: 'POST', json: {} }),
    page: (id) => api(`/api/pages/${id}`),
    deletePage: (id) => api(`/api/pages/${id}`, { method: 'DELETE' }),
    setPageKeep: (id, keep) => api(`/api/pages/${id}/keep`, { method: 'POST', json: { keep } }),
    margin: (pageId, input, { inBook = false } = {}) => send(`/api/pages/${pageId}/margins?inBook=${inBook ? '1' : '0'}`, input),
    deleteMargin: (id) => api(`/api/margins/${id}`, { method: 'DELETE' }),
    setMarginInBook: (id, inBook) => api(`/api/margins/${id}/in-book`, { method: 'POST', json: { inBook } }),
    books: () => api('/api/books'),
    book: (id) => api(`/api/books/${id}`),
    // 試作のサーバーは購読を持つだけで、送らない（送るのは Supabase の Edge Function・work/notify-setup.md）
    savePush: ({ endpoint, p256dh, auth, lang }) => api('/api/push', { method: 'POST', json: { endpoint, p256dh, auth, lang } }),
    deletePush: (endpoint) => api('/api/push', { method: 'DELETE', json: { endpoint } }),
  };
}
