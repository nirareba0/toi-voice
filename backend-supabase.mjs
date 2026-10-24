// 画面の保存の層（Supabase 版）: supabase/schema.sql の関数を rpc で呼び、音声は非公開のバケット voices に置く。
// 決まり（答える前に聞けない・同じグループだけ など）はデータベースの RLS と関数が守る。ここは呼ぶだけ。
// client は supabase-js の createClient(URL, 公開の anon キー) で作ったもの（backend.mjs が作る。鍵はファイルに書かない）。

import { SEASON_METHODS } from './backend-local.mjs';

const BUCKET = 'voices';
const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' };
// 期限つき URL の秒数。聞くたびに作り直す
export const SIGNED_URL_SEC = 300;

// Postgres のエラーの番号を、画面が使う HTTP の数に寄せる（401 で「招待のリンクから」を出す）
// 55000（いまはできない: 番でない・綴じていない・配った後など）は 409
const STATUS = { 28000: 401, 42501: 403, P0002: 404, 23505: 409, 55000: 409, 22023: 400, 23514: 400 };

export function supabaseBackend(client, { signedUrlSec = SIGNED_URL_SEC, uuid = () => crypto.randomUUID() } = {}) {
  const fail = (error) => Object.assign(new Error(error?.message || 'うまくいきませんでした'), { status: STATUS[error?.code] ?? 500 });

  async function rpc(fn, args) {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw fail(error);
    return data;
  }

  async function signedIn() {
    const { data } = await client.auth.getSession();
    return !!data?.session;
  }

  async function signInIfNeeded() {
    if (await signedIn()) return;
    const { error } = await client.auth.signInAnonymously();
    if (error) throw fail(error);
  }

  // 声を先に上げ、名前を関数に渡す。関数が断ったら、上げたファイルを片づける。
  // folder はシーズン版なら問いの id、交換日記版ならノートの id（関数で先に決める）
  async function withAudio(folder, input, call) {
    if (input.kind !== 'voice') return call({ path: null, mime: null, durationSec: null });
    const mime = String(input.audio.blob.type || 'audio/webm').split(';')[0];
    const path = `${typeof folder === 'function' ? await folder() : folder}/${uuid()}.${EXT[mime] ?? 'audio'}`;
    const up = await client.storage.from(BUCKET).upload(path, input.audio.blob, { contentType: mime, upsert: false });
    if (up.error) throw fail(up.error);
    try {
      return await call({ path, mime, durationSec: input.audio.durationSec });
    } catch (err) {
      await client.storage.from(BUCKET).remove([path]);
      throw err;
    }
  }

  // 交換日記の声の置き場所（<ノートの id>/）。ノートの画面から知る
  let notebookId = null;
  async function notebookFolder() {
    if (!notebookId) notebookId = (await rpc('notebook_view'))?.notebook?.id ?? null;
    if (!notebookId) throw Object.assign(new Error('ノートが見つかりません'), { status: 404 });
    return notebookId;
  }

  return {
    // 招待のリンクを開いた人は、匿名のサインインで入る（メールはログインに使わない）
    async join({ invite, displayName, email, consent, promise }) {
      await signInIfNeeded();
      return rpc('join_group', { p_invite: invite, p_display_name: displayName, p_email: email ?? '', p_consent: consent, p_promise: promise ?? null });
    },
    async me() {
      if (!(await signedIn())) throw Object.assign(new Error('招待のリンクから入ってください'), { status: 401 });
      return rpc('me');
    },
    rename: (displayName) => rpc('rename_me', { p_display_name: displayName }),
    async leave() {
      const data = await rpc('leave_group');
      await client.auth.signOut();
      return data;
    },
    prompts: () => rpc('open_prompts'),
    async prompt(id) {
      const view = await rpc('prompt_view', { p_prompt: id });
      await rpc('read_notices', { p_prompt: id });
      return view;
    },
    answer: (promptId, input) => withAudio(promptId, input, (a) => rpc('answer_prompt', {
      p_prompt: promptId, p_kind: input.kind, p_text: input.text ?? null, p_audio_path: a.path, p_mime: a.mime, p_duration: a.durationSec,
    })),
    deleteVoice: (id) => rpc('delete_voice', { p_voice: id }),
    reply: (voiceId, input, { promptId } = {}) => withAudio(promptId, input, (a) => rpc('reply_to_voice', {
      p_voice: voiceId, p_kind: input.kind, p_text: input.text ?? null, p_audio_path: a.path, p_mime: a.mime, p_duration: a.durationSec,
    })),
    deleteReply: (id) => rpc('delete_reply', { p_reply: id }),
    // 期限つき URL。作れるのは、その問いに答えた人だけ（storage.objects の RLS）
    async audioUrl(kind, item) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(item.audioPath, signedUrlSec);
      if (error) throw fail(error);
      return data.signedUrl;
    },
    final: () => rpc('final_for_me'),
    answerFinal: ({ continueChoice, payFor, note }) => rpc('answer_final', { p_continue: continueChoice, p_pay_for: payFor ?? [], p_note: note ?? '' }),
    deleteFinal: () => rpc('delete_final'),
    // ---- 交換日記版（mvp-spec §7）。順番・誰が持っているかは関数が本人にしか返さない（D-2） ----
    // 招待のリンクを開いた人に、交換日記のノートかを返す。関数は authenticated だけが呼べるので、先に匿名のサインインをする
    async inviteInfo(invite) {
      await signInIfNeeded();
      return rpc('invite_info', { p_invite: invite });
    },
    renewInvite: () => rpc('renew_invite'),
    async notebook() {
      const view = await rpc('notebook_view');
      notebookId = view?.notebook?.id ?? notebookId;
      return view;
    },
    drawCards: () => rpc('draw_cards'),
    writePage: (input, { cardId = null, follows = false } = {}) => withAudio(notebookFolder, input, (a) => rpc('write_page', {
      p_kind: input.kind, p_text: input.text ?? null, p_audio_path: a.path, p_mime: a.mime, p_duration: a.durationSec,
      p_card: cardId ?? null, p_follows: !!follows,
    })),
    skipTurn: () => rpc('skip_turn'),
    resumeTurns: () => rpc('resume_turns'),
    page: (id) => rpc('page_view', { p_page: id }),
    deletePage: (id) => rpc('delete_page', { p_page: id }),
    setPageKeep: (id, keep) => rpc('set_page_keep', { p_page: id, p_keep: !!keep }),
    margin: (pageId, input, { inBook = false } = {}) => withAudio(notebookFolder, input, (a) => rpc('write_margin', {
      p_page: pageId, p_kind: input.kind, p_text: input.text ?? null, p_audio_path: a.path, p_mime: a.mime, p_duration: a.durationSec,
      p_in_book: !!inBook,
    })),
    deleteMargin: (id) => rpc('delete_margin', { p_margin: id }),
    setMarginInBook: (id, inBook) => rpc('set_margin_in_book', { p_margin: id, p_in_book: !!inBook }),
    books: () => rpc('books'),
    book: (id) => rpc('book_view', { p_volume: id }),
    // シーズン制（mvp-spec §0-11）の関数は schema.sql にまだ無い。呼ぶと断る（台帳 T30）
    ...Object.fromEntries(SEASON_METHODS.map((name) => [name, async () => {
      throw Object.assign(new Error('この機能は、まだ Supabase 版がありません'), { status: 501 });
    }])),
  };
}
