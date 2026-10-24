// 画面が使う保存の層を選ぶ。index.html の <meta name="toi-voice-backend"> が local（既定・試作のサーバー）か supabase。
// supabase のときは、同じ index.html の meta から、プロジェクトの URL・公開の anon キー・supabase-js の置き場所を読む。
// 値は本番に出すときに本人が入れる（このリポジトリには書かない。anon キーは公開してよい鍵だが、置き場所が決まるまで空にしておく）。
import { localBackend } from './backend-local.mjs';
import { supabaseBackend } from './backend-supabase.mjs';

const meta = (doc, name) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content')?.trim() ?? '';

export async function chooseBackend(doc = document, { load = (url) => import(url) } = {}) {
  const kind = meta(doc, 'toi-voice-backend') || 'local';
  if (kind === 'local') return localBackend();
  if (kind !== 'supabase') throw new Error(`保存の層の名前が正しくありません: ${kind}`);
  const url = meta(doc, 'toi-voice-supabase-url');
  const anonKey = meta(doc, 'toi-voice-supabase-anon-key');
  const lib = meta(doc, 'toi-voice-supabase-js');
  if (!url || !anonKey || !lib) throw new Error('Supabase の URL・公開キー・supabase-js の置き場所が index.html にありません');
  const { createClient } = await load(lib);
  return supabaseBackend(createClient(url, anonKey, { auth: { persistSession: true } }));
}
