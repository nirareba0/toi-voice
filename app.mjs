// 画面（ビルドなしの ES Modules）。文字は textContent で入れ、HTML として扱わない。
// 文言は i18n.mjs の UI（日本語と英語）から取る。ここに日本語を直に書かない（test/i18n.test.mjs が確かめる）
import { createLimit } from './limit.mjs';
import { consentFor, CONSENT_VERSION } from './consent.mjs';
import { chooseBackend } from './backend.mjs';
import { UI, LANG_KEY, pickLang, translateError } from './i18n.mjs';
import { diaryPromiseFor, DIARY_PROMISE_VERSION } from './diary-promise.mjs';

const main = document.getElementById('main');
const stored = () => { try { return localStorage.getItem(LANG_KEY); } catch { return null; } };
let lang = pickLang({ search: location.search, stored: stored(), navigatorLang: navigator.language });
let T = UI[lang];

// 言語を切り替える。選んだ言語は、この端末に覚えておく（サーバーには送らない）
function applyLang() {
  document.documentElement.lang = T.htmlLang;
  document.title = T.docTitle;
  document.querySelector('header h1 a').textContent = T.appTitle;
  document.getElementById('footer').textContent = T.footer;
  document.getElementById('contact').textContent = consentFor(lang).contact; // 相談の窓口はどの画面でも出す（§H の2）
  const btn = document.getElementById('lang');
  btn.textContent = T.switchTo;
  btn.setAttribute('aria-label', T.switchAria);
  btn.setAttribute('lang', T.switchToLang);
}
function setLang(next) {
  lang = next;
  T = UI[lang];
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* 覚えられなくても切り替えはできる */ }
  applyLang();
  route();
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

// 保存の層（backend.mjs）。試作のサーバーか Supabase かを、画面は気にしない
let backend;

// 音声の URL は保存の層が出す（Supabase では期限つき URL なので、届いてから入れる）
function audioEl(kind, item) {
  const el = h('audio', { controls: true, preload: 'none' });
  backend.audioUrl(kind, item).then((url) => { el.src = url; }, () => el.replaceWith(h('span', { class: 'meta' }, T.audioError)));
  return el;
}

const show = (...nodes) => main.replaceChildren(...nodes);
// サーバーの断りは日本語で来る。英語の画面では辞書（i18n.mjs の ERRORS_EN）で英語にする
const errorLine = (err) => h('p', { class: 'error', role: 'alert' }, translateError(err.message, lang));
const sec = (s) => T.sec(Math.round(s));

// ---- 録音（maxSec で自分から止まる・送る前に聞ける・録り直せる） ----
function recorder(maxSec, onSend, label) {
  const box = h('div', { class: 'recorder' });
  let rec = null;
  let chunks = [];
  let limit = null;
  let tick = null;
  let result = null;

  function idle(msg) {
    box.replaceChildren(h('div', { class: 'row' }, h('button', { class: 'primary', onclick: start }, T.recordButton(label, maxSec))), msg ? h('p', { class: 'meta' }, msg) : null);
  }
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return idle(T.noRecorder);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return idle(T.noMic); }
    chunks = [];
    rec = new MediaRecorder(stream, { audioBitsPerSecond: 48000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const durationSec = limit.stop();
      clearInterval(tick);
      const blob = new Blob(chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] });
      result = { blob, durationSec };
      review();
    };
    limit = createLimit(maxSec);
    const timer = h('span', { class: 'timer', 'aria-live': 'off' }, T.remaining(maxSec));
    box.replaceChildren(h('div', { class: 'row' }, h('span', {}, T.recording), timer, h('button', { onclick: () => rec.state !== 'inactive' && rec.stop() }, T.stop)));
    tick = setInterval(() => { timer.textContent = T.remaining(limit.remaining()); }, 250);
    limit.start(() => rec.state !== 'inactive' && rec.stop());
    rec.start();
  }
  function review() {
    const url = URL.createObjectURL(result.blob);
    const send = h('button', { class: 'primary', onclick: async () => {
      send.disabled = true;
      try { await onSend(result); URL.revokeObjectURL(url); } catch (err) { send.disabled = false; box.append(errorLine(err)); }
    } }, T.send);
    box.replaceChildren(h('p', { class: 'meta' }, T.recorded(sec(result.durationSec))), h('audio', { controls: true, src: url }),
      h('div', { class: 'row' }, send, h('button', { onclick: () => { URL.revokeObjectURL(url); start(); } }, T.rerecord)));
  }
  idle();
  return box;
}

// ---- 約束（privacy-terms-draft.md §A と同じ文。英語は下書きの断りを上に出す） ----
const consentBox = () => {
  const c = consentFor(lang);
  return h('section', { class: 'card consent', 'aria-labelledby': 'consent-title' },
    h('h3', { id: 'consent-title' }, c.title),
    c.draftNote ? h('p', { class: 'draft', role: 'note' }, c.draftNote) : null,
    c.sections.map(([title, lines]) => [h('h4', {}, title), h('ul', {}, lines.map((l) => h('li', {}, l)))]),
    h('h4', {}, c.separateTitle), h('ul', {}, c.separate.map(([, l]) => h('li', {}, l))));
};

// 約束と別の欄の同意（§H の2・9）。1つずつ印を付ける。全部に印が無いと入れない
const separateChecks = () => consentFor(lang).separate.map(([id, l]) =>
  h('label', { class: 'check' }, h('input', { type: 'checkbox', id: `agree-${id}`, required: true }), ` ${l}`));

// 交換日記のノートだけに足す「社内で使うときの約束」（diary-promise.mjs・mvp-spec §7-7）と書き方の案内（§7-5）
const diaryPromiseBox = () => {
  const d = diaryPromiseFor(lang);
  const note = consentFor(lang).draftNote;
  return h('section', { class: 'card consent' }, h('h3', {}, d.title),
    note ? h('p', { class: 'draft', role: 'note' }, note) : null,
    h('ol', {}, d.items.map((l) => h('li', {}, l))),
    h('h4', {}, d.guideTitle), h('ul', {}, d.guide.map((l) => h('li', {}, l))));
};

// ---- 入る（F1）。約束を読んで同意しないと入れない。どちらの言語で読んだかも残す ----
async function joinView(invite) {
  const info = await backend.inviteInfo(invite);
  const diary = info.mode === 'diary';
  const name = h('input', { type: 'text', id: 'name', maxlength: 20, required: true, autocomplete: 'nickname' });
  const email = h('input', { type: 'email', id: 'email', autocomplete: 'email' });
  const agree = h('input', { type: 'checkbox', id: 'agree', required: true });
  const separate = separateChecks();
  const out = h('div');
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    if (!agree.checked) return out.replaceChildren(errorLine(new Error(T.mustAgree)));
    if (separate.some((l) => !l.querySelector('input').checked)) return out.replaceChildren(errorLine(new Error(T.mustAgreeSeparate)));
    try {
      await backend.join({ invite, displayName: name.value, email: email.value, consent: CONSENT_VERSION, consentLang: lang, promise: diary ? DIARY_PROMISE_VERSION : undefined });
      history.replaceState(null, '', '/#/'); // 招待の文字列を URL から消す
      route();
    } catch (err) { out.replaceChildren(errorLine(err)); }
  } },
  h('label', { for: 'name' }, T.nameLabel), name,
  h('label', { for: 'email' }, T.emailLabel), email,
  h('label', { class: 'check' }, agree, T.agreeLabel),
  ...separate,
  h('div', { class: 'row' }, h('button', { class: 'primary', type: 'submit' }, T.joinButton)), out);
  show(h('h2', {}, diary ? T.nbJoinTitle(info.name) : T.joinTitle), h('p', {}, diary ? T.nbJoinIntro : T.joinIntro), consentBox(), diary ? diaryPromiseBox() : null, form);
}

// ---- 自分のこと（表示名を直す・約束を読み直す・抜けて全部消す） ----
function selfSection(me) {
  const name = h('input', { type: 'text', maxlength: 20, value: me.displayName, 'aria-label': T.renameAria });
  const out = h('div');
  const leave = async () => {
    if (!confirm(T.leaveConfirm)) return;
    try {
      await backend.leave();
      document.getElementById('who').textContent = '';
      show(h('p', { role: 'status' }, T.leftDone));
    } catch (err) { out.replaceChildren(errorLine(err)); }
  };
  return h('section', { class: 'self' }, h('h2', {}, T.selfTitle),
    h('div', { class: 'row' }, name, h('button', { class: 'small', onclick: async () => {
      try { await backend.rename(name.value); route(); } catch (err) { out.replaceChildren(errorLine(err)); }
    } }, T.renameButton)),
    h('details', {}, h('summary', {}, T.readConsent), consentBox()),
    me.mode === 'diary' ? h('details', {}, h('summary', {}, T.nbReadPromise), diaryPromiseBox()) : null,
    h('div', { class: 'row' }, h('button', { class: 'small danger', onclick: leave }, T.leaveButton)),
    out);
}

// ---- 問いの一覧とお知らせ（F2・F6） ----
async function homeView() {
  const me = await backend.me();
  if (me.mode === 'diary') return notebookView(me);
  const [prompts, keep, collection] = await Promise.all([backend.prompts(),
    backend.keepList().catch(() => ({ open: false })), backend.collection().catch(() => null)]);
  document.getElementById('who').textContent = T.who(me.displayName, me.group);
  const notices = me.notices.filter((n) => n.kind !== 'prompt');
  show(
    notices.length ? h('section', {}, h('h2', {}, T.noticesTitle), h('ul', { class: 'plain' }, notices.map((n) => h('li', { class: 'card notice' },
      h('a', { href: `#/p/${n.promptId}` }, n.kind === 'mark' ? T.noticeMark : T.noticeReply), h('div', { class: 'meta' }, n.text))))) : null,
    me.final.open ? h('p', { class: 'card notice' }, h('a', { href: '#/final' }, me.final.mine ? T.finalOpenMine : T.finalOpen)) : null,
    me.final.closed && me.final.mine ? h('p', { class: 'card' }, h('a', { href: '#/final' }, T.finalClosedMine)) : null,
    keep.open ? h('p', { class: 'card notice' }, h('a', { href: '#/keep' }, T.keepOpen)) : null,
    collection ? h('p', { class: 'card notice' }, h('a', { href: '#/collection' }, collection.state === 'review' ? T.collectionReviewLink : T.collectionTitle)) : null,
    h('h2', {}, T.promptsTitle),
    prompts.length ? h('ul', { class: 'plain' }, [...prompts].reverse().map((p) => h('li', { class: 'card' },
      h('a', { href: `#/p/${p.id}` }, p.text), h('div', { class: 'meta' }, p.myAnswer ? T.answered(T.kindLabels[p.myAnswer]) : T.notAnswered)))) : h('p', {}, T.noPrompts),
    selfSection(me),
  );
}

// ---- 1つの問い（F3・F4・F5・F7） ----
async function promptView(id) {
  const v = await backend.prompt(id);
  const reload = () => promptView(id);
  const head = [h('p', {}, h('a', { href: '#/' }, T.backToList)), h('h2', {}, v.prompt.text)];
  // 指名（mvp-spec §0-4）: 自分が指名かだけを出す。仲間には「2人が指名されている」ことだけ
  if (v.nomination && !v.myAnswer) {
    head.push(v.nomination.me
      ? h('p', { class: 'card notice' }, T.nominatedMe,
        h('button', { class: 'small', onclick: async () => { await backend.swapNomination(id); reload(); } }, T.swap))
      : h('p', { class: 'meta' }, T.nominatedOthers));
  }
  if (v.afterDeadline) head.push(h('p', { class: 'meta' }, T.afterDeadline));
  if (!v.myAnswer) {
    const text = h('textarea', { rows: 4, maxlength: 400, id: 'answer-text' });
    const out = h('div');
    const guard = (fn) => async () => { try { await fn(); reload(); } catch (err) { out.replaceChildren(errorLine(err)); } };
    const form = [
      v.afterDeadline ? null : h('p', {}, T.answerUnlocks),
      recorder(60, async (audio) => { await backend.answer(id, { kind: 'voice', audio }); reload(); }, T.answerVoice),
      h('details', {}, h('summary', {}, T.answerText), h('label', { for: 'answer-text' }, T.textMax), text,
        h('div', { class: 'row' }, h('button', { onclick: guard(() => backend.answer(id, { kind: 'text', text: text.value })) }, T.sendText))),
      h('div', { class: 'row' }, h('button', { onclick: guard(() => backend.answer(id, { kind: 'pass' })) }, T.pass)),
      out];
    // 締め切りの前は答える画面だけ。後は答える画面の下に仲間の声も出す
    if (!v.afterDeadline) return show(...head, ...form);
    head.push(...form);
  }
  const del = (fn, msg) => async () => { if (confirm(msg)) { await fn(); reload(); } };
  const items = v.voices.map((x) => {
    const replyText = h('input', { type: 'text', maxlength: 140, 'aria-label': T.replyAria, placeholder: T.replyPlaceholder });
    const out = h('div');
    const act = (fn) => async () => { try { await fn(); reload(); } catch (err) { out.replaceChildren(errorLine(err)); } };
    return h('li', { class: 'card' },
      h('div', { class: 'meta' }, T.voiceMeta(x.by, x.mine, x.kind === 'voice' ? T.voiceLen(sec(x.durationSec)) : T.kindLabels.text)),
      x.kind === 'voice' ? audioEl('voice', x) : h('p', {}, x.text),
      h('div', { class: 'row' },
        x.mine ? h('span', { class: 'meta' }, T.marksMine(x.marks))
          : h('button', { class: 'small', disabled: x.markedByMe, onclick: act(() => backend.reply(x.id, { kind: 'mark' }, { promptId: id })) }, x.markedByMe ? T.markDone(x.marks) : T.mark(x.marks)),
        x.mine ? h('button', { class: 'small', onclick: del(() => backend.deleteVoice(x.id), T.deleteVoiceConfirm) }, T.deleteButton) : null,
        // 講座で紹介してよい（S10）: 押した声だけ運営者が聞ける。いつでも外せる
        x.mine ? h('button', { class: 'small', onclick: act(() => backend.setShare(x.id, !x.shared)) }, x.shared ? T.shareOn : T.shareOff) : null),
      x.replies.length ? h('ul', { class: 'plain replies' }, x.replies.map((r) => h('li', {},
        h('span', { class: 'meta' }, T.replyBy(r.by)),
        r.kind === 'voice' ? audioEl('reply', r) : r.text,
        r.mine ? h('button', { class: 'small', onclick: del(() => backend.deleteReply(r.id), T.deleteReplyConfirm) }, T.deleteButton) : null))) : null,
      h('details', {}, h('summary', {}, T.replyToggle),
        h('div', { class: 'row' }, replyText, h('button', { class: 'small', onclick: act(() => backend.reply(x.id, { kind: 'text', text: replyText.value }, { promptId: id })) }, T.send)),
        recorder(30, async (audio) => { await backend.reply(x.id, { kind: 'voice', audio }, { promptId: id }); reload(); }, T.replyVoice)),
      out);
  });
  show(...head,
    v.myAnswer?.kind === 'pass' ? h('p', { class: 'meta' }, T.passed, h('button', { class: 'small', onclick: del(() => backend.deleteVoice(v.myAnswer.id), T.undoPassConfirm) }, T.undoPass)) : null,
    v.voices.length ? h('ul', { class: 'plain' }, items) : h('p', {}, T.noVoices));
}

// ---- 最後の問い（F9） ----
async function finalView() {
  const f = await backend.final();
  const back = h('p', {}, h('a', { href: '#/' }, T.backToList));
  const out = h('div');
  const delMine = f.mine ? h('div', { class: 'row' }, h('button', { class: 'small', onclick: async () => {
    if (!confirm(T.finalDeleteConfirm)) return;
    try { await backend.deleteFinal(); finalView(); } catch (err) { out.replaceChildren(errorLine(err)); }
  } }, T.finalDeleteMine)) : null;
  if (f.closed) return show(back, h('h2', {}, T.finalTitle), h('p', {}, T.finalClosed), delMine, out);
  if (!f.open) return show(h('p', {}, T.finalNotYet), back);
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await backend.answerFinal({ continueChoice: fd.get('continue'), payFor: fd.getAll('pay'), note: fd.get('note') });
      out.replaceChildren(h('p', { role: 'status' }, T.finalThanks));
    } catch (err) { out.replaceChildren(errorLine(err)); }
  } },
  h('fieldset', {}, h('legend', {}, T.continueLegend), Object.entries(T.continueLabels).map(([k, l]) =>
    h('label', {}, h('input', { type: 'radio', name: 'continue', value: k, required: true, checked: f.mine?.continueChoice === k }), ` ${l}`))),
  h('fieldset', {}, h('legend', {}, T.payLegend), Object.entries(T.payLabels).map(([k, l]) =>
    h('label', {}, h('input', { type: 'checkbox', name: 'pay', value: k, checked: f.mine?.payFor.includes(k) }), ` ${l}`))),
  h('label', { for: 'note' }, T.noteLabel), h('textarea', { id: 'note', name: 'note', rows: 3, maxlength: 400 }, f.mine?.note ?? ''),
  h('div', { class: 'row' }, h('button', { class: 'primary', type: 'submit' }, T.answerButton)));
  show(back, h('h2', {}, T.finalTitle), h('p', { class: 'meta' }, T.finalHint), form, delMine, out);
}

// ---- 残す声を選ぶ（S9・最終週）。何も選ばなくてよい ----
async function keepView() {
  const k = await backend.keepList();
  const back = h('p', {}, h('a', { href: '#/' }, T.backToList));
  const can = k.open || k.review;
  const items = k.items.map((x) => h('li', { class: 'card' },
    h('div', { class: 'meta' }, T.keepItem(x.position, x.prompt, T.kindLabels[x.kind])),
    can && (k.open || x.keep) ? h('button', { class: 'small', onclick: async () => { await backend.setKeep(x.id, !x.keep); keepView(); } },
      x.keep ? T.keepOn : T.keepOff) : h('span', { class: 'meta' }, x.keep ? T.kept : T.notKept)));
  show(back, h('h2', {}, T.keepTitle),
    h('p', {}, k.review ? T.keepReview : T.keepIntro),
    items.length ? h('ul', { class: 'plain' }, items) : h('p', {}, T.noVoicesYet));
}

// ---- 知らなかった集（S9） ----
async function collectionView() {
  const c = await backend.collection();
  const back = h('p', {}, h('a', { href: '#/' }, T.backToList));
  if (!c) return show(back, h('p', {}, T.collectionNotYet));
  show(back, h('h2', {}, T.collectionTitle),
    c.state === 'review' ? h('p', { class: 'meta' }, T.collectionReview, ' ', h('a', { href: '#/keep' }, T.keepTitle)) : null,
    h('ul', { class: 'plain' }, c.items.map((x) => h('li', { class: 'card' },
      h('div', { class: 'meta' }, T.collectionItem(x.position, x.prompt, x.by)),
      x.kind === 'voice' ? audioEl('voice', x) : h('p', {}, x.text)))));
}

// ---- 交換日記版（mvp-spec §7）: ノートの画面・書き手の画面・ページと余白・冊子の棚 ----
// 誰がノートを持っているか・順番・誰がお休みしたかは、どの画面にも出さない（D-2・D-3）
const toNotebook = () => h('p', {}, h('a', { href: '#/' }, T.nbBack));
const when = (t) => new Date(t).toLocaleString(T.htmlLang, { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const pageLen = (x) => (x.kind === 'voice' ? T.voiceLen(sec(x.durationSec)) : T.kindLabels.text);

async function notebookView(me) {
  const nb = await backend.notebook();
  document.getElementById('who').textContent = T.who(me.displayName, me.group);
  document.getElementById('footer').textContent = T.nbFooter;
  const notices = [
    nb.myTurn ? h('li', { class: 'card notice' }, h('a', { href: '#/write' }, nb.turn.remind ? T.nbNoticeRemind : T.nbNoticeTurn)) : null,
    ...nb.binding.filter((b) => b.myPages).map((b) => h('li', { class: 'card notice' }, h('a', { href: `#/book/${b.id}` }, T.nbNoticeBind))),
    ...nb.notices.map((n) => h('li', { class: 'card notice' }, h('a', { href: `#/page/${n.pageId}` }, n.kind === 'mark' ? T.nbNoticeMark : T.nbNoticeMargin))),
  ].filter(Boolean);
  const out = h('div');
  const renew = async () => {
    try {
      const r = await backend.renewInvite();
      out.replaceChildren(h('p', { class: 'meta' }, T.nbInviteNew), h('code', {}, `${new URL('join', location.href.split('#')[0])}#${r.invite}`));
    } catch (err) { out.replaceChildren(errorLine(err)); }
  };
  show(
    notices.length ? h('section', {}, h('h2', {}, T.noticesTitle), h('ul', { class: 'plain' }, notices)) : null,
    h('h2', {}, nb.notebook.name),
    h('p', { class: 'meta' }, nb.state === 'running' ? T.nbRunning(nb.volume.number, nb.volume.pages) : nb.state === 'waiting' ? T.nbWaiting : T.nbStopped),
    nb.myTurn ? h('p', { class: 'card notice' }, h('a', { href: '#/write' }, T.nbYourTurn)) : null,
    nb.resting ? h('p', { class: 'card' }, T.nbResting, ' ', h('button', { class: 'small', onclick: async () => { await backend.resumeTurns(); route(); } }, T.nbResume)) : null,
    nb.binding.map((b) => h('p', { class: 'card' }, h('a', { href: `#/book/${b.id}` }, T.nbBindingLink(b.number, when(b.reviewEndsAt))))),
    nb.volume ? h('h3', {}, T.nbPagesTitle(nb.volume.number)) : null,
    nb.pages.length ? h('ul', { class: 'plain' }, nb.pages.map((x) => h('li', { class: 'card' },
      h('a', { href: `#/page/${x.id}` }, x.cardText ?? (x.follows ? T.nbFollowed : T.nbFree)),
      h('div', { class: 'meta' }, T.voiceMeta(x.by, x.mine, pageLen(x)), ' · ', T.nbMarginCount(x.margins.length, x.marks))))) : h('p', {}, T.nbNoPages),
    h('p', {}, h('a', { href: '#/books' }, T.nbShelfLink(nb.shelf))),
    h('details', {}, h('summary', {}, T.nbInviteToggle), h('p', { class: 'meta' }, T.nbInviteHint),
      h('div', { class: 'row' }, h('button', { class: 'small', onclick: renew }, T.nbInviteButton)), out),
    selfSection(me),
  );
}

// 書き手の画面（自分の番のときだけ）: 前の人から届いたページ → カードを引くか自由に → 声か文字で書いて渡す／お休み
async function writeView() {
  const nb = await backend.notebook();
  if (!nb.myTurn) return show(toNotebook(), h('p', {}, T.nbNotYourTurn));
  let choice = { cardId: null, follows: false };
  const chosen = h('p', { class: 'meta', 'aria-live': 'polite' }, T.nbFreeChosen);
  const cardsBox = h('div');
  const out = h('div');
  const pick = (c, label) => { choice = c; chosen.textContent = label; };
  const draw = async () => {
    try {
      const cards = await backend.drawCards();
      cardsBox.replaceChildren(h('ul', { class: 'plain' }, cards.map((c) => h('li', {},
        h('button', { class: 'small', onclick: () => pick({ cardId: c.id, follows: false }, T.nbCardChosen(c.text)) }, c.text)))));
    } catch (err) { cardsBox.replaceChildren(errorLine(err)); }
  };
  const done = () => show(h('p', { role: 'status' }, T.nbHanded), toNotebook());
  const write = async (input) => { await backend.writePage(input, choice); done(); };
  const text = h('textarea', { rows: 5, maxlength: 400, id: 'page-text' });
  const from = nb.turn.from;
  show(toNotebook(), h('h2', {}, T.nbWriteTitle),
    h('p', { class: 'card' }, from ? [T.nbFrom(from.name), ' ', h('a', { href: `#/page/${from.pageId}` }, T.nbReadIt)] : T.nbNewVolume),
    h('p', { class: 'meta' }, T.nbDue(when(nb.turn.dueAt))),
    h('h3', {}, T.nbHowTitle),
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: draw }, T.nbDraw),
      h('button', { class: 'small', onclick: () => { cardsBox.replaceChildren(); pick({ cardId: null, follows: false }, T.nbFreeChosen); } }, T.nbFree),
      from ? h('button', { class: 'small', onclick: () => { cardsBox.replaceChildren(); pick({ cardId: null, follows: true }, T.nbFollowChosen(from.name)); } }, T.nbFollow) : null),
    cardsBox, chosen,
    recorder(60, (audio) => write({ kind: 'voice', audio }), T.nbWriteVoice),
    h('details', {}, h('summary', {}, T.nbWriteText), h('label', { for: 'page-text' }, T.textMax), text,
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: async () => {
        try { await write({ kind: 'text', text: text.value }); } catch (err) { out.replaceChildren(errorLine(err)); }
      } }, T.nbHandOff))),
    h('div', { class: 'row' }, h('button', { onclick: async () => {
      if (!confirm(T.nbSkipConfirm)) return;
      try { await backend.skipTurn(); done(); } catch (err) { out.replaceChildren(errorLine(err)); }
    } }, T.nbSkip)),
    h('p', { class: 'meta' }, T.nbSkipHint),
    out);
}

// 1ページと余白。余白を書くとき「冊子に入れてよい」を選べる（既定は入れない）
async function notebookPageView(id) {
  const x = await backend.page(id);
  const reload = () => notebookPageView(id);
  const out = h('div');
  const act = (fn) => async () => { try { await fn(); reload(); } catch (err) { out.replaceChildren(errorLine(err)); } };
  const del = (fn, msg) => async () => { if (confirm(msg)) await act(fn)(); };
  const open = x.volume.state !== 'released';
  const marginText = h('input', { type: 'text', maxlength: 140, 'aria-label': T.replyAria, placeholder: T.nbMarginPlaceholder });
  const inBook = h('input', { type: 'checkbox' });
  show(toNotebook(),
    h('p', { class: 'meta' }, T.nbVolumeLabel(x.volume.number, T.nbVolumeStates[x.volume.state])),
    h('h2', {}, x.cardText ?? (x.follows ? T.nbFollowed : T.nbFree)),
    h('div', { class: 'meta' }, T.voiceMeta(x.by, x.mine, pageLen(x))),
    x.kind === 'voice' ? audioEl('page', x) : h('p', {}, x.text),
    h('div', { class: 'row' },
      x.mine ? h('span', { class: 'meta' }, T.marksMine(x.marks))
        : h('button', { class: 'small', disabled: x.markedByMe || !open, onclick: act(() => backend.margin(id, { kind: 'mark' })) }, x.markedByMe ? T.markDone(x.marks) : T.mark(x.marks)),
      x.mine ? h('button', { class: 'small', onclick: async () => {
        if (!confirm(T.nbDeletePageConfirm)) return;
        try { await backend.deletePage(id); location.hash = '#/'; } catch (err) { out.replaceChildren(errorLine(err)); }
      } }, T.deleteButton) : null),
    h('h3', {}, T.nbMarginsTitle),
    x.margins.length ? h('ul', { class: 'plain replies' }, x.margins.map((r) => h('li', {},
      h('span', { class: 'meta' }, T.replyBy(r.by)),
      r.kind === 'voice' ? audioEl('margin', r) : r.text,
      r.mine && open ? h('button', { class: 'small', onclick: act(() => backend.setMarginInBook(r.id, !r.inBook)) }, r.inBook ? T.nbInBookOn : T.nbInBookOff) : null,
      r.mine ? h('button', { class: 'small', onclick: del(() => backend.deleteMargin(r.id), T.nbDeleteMarginConfirm) }, T.deleteButton) : null))) : h('p', { class: 'meta' }, T.nbNoMargins),
    open ? h('section', {},
      h('label', { class: 'check' }, inBook, T.nbInBookLabel),
      h('div', { class: 'row' }, marginText, h('button', { class: 'small', onclick: act(() => backend.margin(id, { kind: 'text', text: marginText.value }, { inBook: inBook.checked })) }, T.send)),
      recorder(30, async (audio) => { await backend.margin(id, { kind: 'voice', audio }, { inBook: inBook.checked }); reload(); }, T.nbMarginVoice)) : null,
    out);
}

// 冊子の棚: 綴じた冊が並ぶ（ノートの「たまっていく記録」）
async function shelfView() {
  const list = await backend.books();
  show(toNotebook(), h('h2', {}, T.nbShelfTitle),
    list.length ? h('ul', { class: 'plain' }, list.map((b) => h('li', { class: 'card' },
      h('a', { href: `#/book/${b.id}` }, T.nbVolumeLabel(b.number, T.nbVolumeStates[b.state])),
      h('div', { class: 'meta' }, T.nbBookPages(b.pages))))) : h('p', {}, T.nbShelfEmpty));
}

// 1冊の冊子。確かめの間は、自分のページを残すか選べる（何も選ばなくてよい）
async function bookView(id) {
  const b = await backend.book(id);
  const reload = () => bookView(id);
  const out = h('div');
  show(toNotebook(), h('p', {}, h('a', { href: '#/books' }, T.nbShelfTitle)),
    h('h2', {}, T.nbVolumeLabel(b.number, T.nbVolumeStates[b.state])),
    b.state === 'review' ? h('p', { class: 'meta' }, T.nbReviewHint(when(b.reviewEndsAt))) : null,
    b.mine ? h('section', {}, h('h3', {}, T.nbKeepTitle),
      b.mine.length ? h('ul', { class: 'plain' }, b.mine.map((p) => h('li', { class: 'card' },
        h('div', { class: 'meta' }, p.cardText ?? T.nbFree, ' · ', T.kindLabels[p.kind]),
        p.kind === 'text' ? h('p', {}, p.text) : null,
        h('button', { class: 'small', onclick: async () => {
          try { await backend.setPageKeep(p.id, !p.keep); reload(); } catch (err) { out.replaceChildren(errorLine(err)); }
        } }, p.keep ? T.keepOn : T.nbKeepOff)))) : h('p', { class: 'meta' }, T.nbNoMyPages)) : null,
    out,
    h('h3', {}, T.nbBookTitle),
    b.items.length ? h('ul', { class: 'plain' }, b.items.map((x) => h('li', { class: 'card' },
      h('div', { class: 'meta' }, T.voiceMeta(x.by, x.mine, x.cardText ?? T.nbFree)),
      x.kind === 'voice' ? audioEl('page', x) : h('p', {}, x.text),
      x.margins.length ? h('ul', { class: 'plain replies' }, x.margins.map((r) => h('li', {},
        h('span', { class: 'meta' }, T.replyBy(r.by)), r.kind === 'voice' ? audioEl('margin', r) : r.text))) : null))) : h('p', {}, T.nbBookEmpty));
}

async function route() {
  try {
    if (location.hash === '#/keep') return await keepView();
    if (location.hash === '#/collection') return await collectionView();
    if (location.hash === '#/write') return await writeView();
    if (location.hash === '#/books') return await shelfView();
    const page = location.hash.match(/^#\/page\/([\w-]+)$/);
    if (page) return await notebookPageView(page[1]);
    const book = location.hash.match(/^#\/book\/([\w-]+)$/);
    if (book) return await bookView(book[1]);
    // GitHub Pages ではサブフォルダ（/toi-voice/join）や join.html になるので、末尾で見る
    if (/\/join(\.html)?$/.test(location.pathname) && location.hash.length > 1) return await joinView(location.hash.slice(1));
    const m = location.hash.match(/^#\/p\/([\w-]+)$/);
    if (m) return await promptView(m[1]);
    if (location.hash === '#/final') return await finalView();
    return await homeView();
  } catch (err) {
    if (err.status === 401) return show(h('p', {}, T.signInFirst));
    show(errorLine(err));
  }
}

applyLang();
document.getElementById('lang').addEventListener('click', () => setLang(T.switchToLang));
try {
  backend = await chooseBackend();
  addEventListener('hashchange', route);
  route();
} catch (err) {
  show(errorLine(err));
}
