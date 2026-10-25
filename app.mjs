// 画面（ビルドなしの ES Modules）。文字は textContent で入れ、HTML として扱わない。
// 文言は i18n.mjs の UI（日本語と英語）から取る。ここに日本語を直に書かない（test/i18n.test.mjs が確かめる）
import { createLimit } from './limit.mjs';
import { consentFor, CONSENT_VERSION } from './consent.mjs';
import { chooseBackend } from './backend.mjs';
import { UI, LANG_KEY, pickLang, translateError } from './i18n.mjs';
import { diaryPromiseFor, diarySummaryFor, diarySampleFor, DIARY_PROMISE_VERSION } from './diary-promise.mjs';
import { logPromiseFor, logSummaryFor, logSampleFor, LOG_PROMISE_VERSION } from './log-promise.mjs';
import { SPEED_KEY, pickSpeed, nextSpeed, clock, lengthOf, seekTo, levelOf, pushLevel } from './voice.mjs';
import { TUTORIAL, PLATFORMS, VAPID_META, platformOf, pushState, turnOn, turnOff } from './notify.mjs';

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
  el.append(...kids(children));
  return el;
}
// 子の並び: 入れ子の配列は平らにし、null・undefined・false は落とす。
// replaceChildren(null) はブラウザでは「null」という文字になるので、置き換えるときも必ずここを通す（T35）
function kids(list) {
  return list.flat(Infinity).filter((c) => c != null && c !== false).map((c) => (c instanceof Node ? c : String(c)));
}
const fill = (el, ...children) => el.replaceChildren(...kids(children));

// 保存の層（backend.mjs）。試作のサーバーか Supabase かを、画面は気にしない
let backend;
// いまのグループの種類（me の mode: season・diary・log）。入った・抜けたら null に戻して読み直す
let mode = null;
async function currentMode() {
  if (mode == null) mode = await backend.me().then((me) => me.mode, () => null);
  return mode;
}

// ---- 声を聞く（T33）: 再生・止める・聞く位置のつまみ（途中から聞ける）・速さ（1倍・1.5倍） ----
// 速さは全部の声で同じにし、この端末に覚えておく。長さは記録の秒数を先に使う（録音した webm は長さが無いことがある）
let speed = pickSpeed((() => { try { return localStorage.getItem(SPEED_KEY); } catch { return null; } })());
function setSpeed(next) {
  speed = next;
  try { localStorage.setItem(SPEED_KEY, String(speed)); } catch { /* 覚えられなくても、この画面では変わる */ }
  for (const a of document.querySelectorAll('.player audio')) { a.defaultPlaybackRate = speed; a.playbackRate = speed; }
  for (const b of document.querySelectorAll('.player .speed')) b.textContent = T.speedButton(speed);
}

// src は URL か、URL を返す Promise（Supabase では期限つき URL なので、届いてから入れる）
function player(src, durationSec) {
  const audio = h('audio', { preload: 'none' });
  let length = lengthOf(NaN, durationSec);
  let dragging = false;
  const play = h('button', { class: 'small play', type: 'button', disabled: true }, T.playButton);
  const seek = h('input', { type: 'range', min: 0, max: Math.max(length, 0.1), step: 0.1, value: 0, 'aria-label': T.seekAria, disabled: true });
  const time = h('span', { class: 'meta time' }, `${clock(0)} / ${clock(length)}`);
  const rate = h('button', { class: 'small speed', type: 'button', 'aria-label': T.speedAria, onclick: () => setSpeed(nextSpeed(speed)) }, T.speedButton(speed));
  const paint = (at = audio.currentTime) => {
    time.textContent = `${clock(at)} / ${clock(length)}`;
    seek.setAttribute('aria-valuetext', T.seekValue(clock(at), clock(length)));
    if (!dragging) seek.value = String(at);
  };
  audio.addEventListener('loadedmetadata', () => { length = lengthOf(audio.duration, durationSec); seek.max = String(Math.max(length, 0.1)); paint(); });
  audio.addEventListener('timeupdate', () => paint());
  audio.addEventListener('play', () => { audio.playbackRate = speed; play.textContent = T.pauseButton; });
  audio.addEventListener('pause', () => { play.textContent = T.playButton; });
  play.addEventListener('click', () => (audio.paused ? audio.play().catch(() => {}) : audio.pause()));
  seek.addEventListener('input', () => { dragging = true; paint(Number(seek.value)); });
  seek.addEventListener('change', () => { audio.currentTime = seekTo(seek.value, length); dragging = false; paint(); });
  const box = h('div', { class: 'player' }, audio, h('div', { class: 'row' }, play, seek, time, rate));
  Promise.resolve(src).then((url) => {
    audio.src = url;
    audio.defaultPlaybackRate = speed;
    play.disabled = false;
    seek.disabled = false;
  }, () => box.replaceWith(h('span', { class: 'meta' }, T.audioError)));
  return box;
}

// 音声の URL は保存の層が出す
const audioEl = (kind, item) => player(backend.audioUrl(kind, item), item.durationSec);

// 録音中の波形（T33）: 右が新しい。色は style.css の変数から取る（暗い画面でも同じ決まり）
const WAVE_BARS = 60;
function paintWave(canvas, levels) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const { width: w, height: hh } = canvas;
  const bar = w / WAVE_BARS;
  g.clearRect(0, 0, w, hh);
  g.fillStyle = getComputedStyle(canvas).getPropertyValue('--accent').trim() || 'currentColor';
  levels.forEach((lv, i) => {
    const y = Math.max(2, lv * hh);
    g.fillRect((WAVE_BARS - levels.length + i) * bar + bar * 0.2, (hh - y) / 2, bar * 0.6, y);
  });
}

const show = (...nodes) => fill(main, ...nodes);
// 空の値（null・undefined・空の文字・NaN）は画面に出さない（T35）
const has = (v) => v != null && v !== '' && !(typeof v === 'number' && Number.isNaN(v));
// 抜けた人などで名前が無いときは「だれか」にする
const byName = (by) => (has(by) ? by : T.someone);
// 上の右の名前。グループの名前が無いとき（交換日記・Supabase 版）は表示名だけ
function setWho(me) {
  const name = has(me.displayName) ? me.displayName : '';
  document.getElementById('who').textContent = me.mode !== 'diary' && me.mode !== 'log' && name && has(me.group) ? T.who(name, me.group) : name;
}
// サーバーの断りは日本語で来る。英語の画面では辞書（i18n.mjs の ERRORS_EN）で英語にする
const errorLine = (err) => h('p', { class: 'error', role: 'alert' }, translateError(err.message, lang));
const sec = (s) => T.sec(Math.round(Number(s) || 0));

// ---- 録音（maxSec で自分から止まる・送る前に聞ける・録り直せる） ----
// big: 書く画面の主な行動。大きな丸いボタンにする（T35・work/ui-patterns.md）
function recorder(maxSec, onSend, label, { big = false } = {}) {
  const box = h('div', { class: 'recorder' });
  let rec = null;
  let chunks = [];
  let limit = null;
  let tick = null;
  let result = null;
  let meter = null; // 波形のための AudioContext と描く周期（録音中だけ）

  // 波形は飾り（読み上げは残り秒数）。AudioContext が無いブラウザでは出さない
  function startWave(stream, canvas) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      const ac = new AC();
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      ac.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const m = { ac, raf: 0, levels: [] };
      const draw = () => {
        analyser.getByteTimeDomainData(buf);
        m.levels = pushLevel(m.levels, levelOf(buf), WAVE_BARS);
        paintWave(canvas, m.levels);
        m.raf = requestAnimationFrame(draw);
      };
      draw();
      return m;
    } catch { return null; }
  }
  function stopWave() {
    if (!meter) return;
    cancelAnimationFrame(meter.raf);
    meter.ac.close().catch(() => {});
    meter = null;
  }

  function idle(msg) {
    const button = big
      ? h('button', { class: 'record-big', type: 'button', onclick: start }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', {}, label), h('small', {}, T.upTo(maxSec)))
      : h('button', { class: 'primary', type: 'button', onclick: start }, T.recordButton(label, maxSec));
    fill(box, h('div', { class: big ? 'row center' : 'row' }, button), msg ? h('p', { class: 'meta' }, msg) : null);
  }
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return idle(T.noRecorder);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return idle(T.noMic); }
    chunks = [];
    rec = new MediaRecorder(stream, { audioBitsPerSecond: 48000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stopWave();
      stream.getTracks().forEach((t) => t.stop());
      const durationSec = limit.stop();
      clearInterval(tick);
      const blob = new Blob(chunks, { type: (rec.mimeType || 'audio/webm').split(';')[0] });
      result = { blob, durationSec };
      review();
    };
    limit = createLimit(maxSec);
    // 残り秒数は大きく。残り10秒を切ったら色を変える（T33）
    const timer = h('span', { class: 'timer', 'aria-live': 'off' }, T.remaining(maxSec));
    const wave = h('canvas', { class: 'wave', width: 600, height: 96, 'aria-hidden': 'true' });
    box.replaceChildren(h('div', { class: 'row' }, h('span', {}, T.recording), timer, h('button', { onclick: () => rec.state !== 'inactive' && rec.stop() }, T.stop)), wave);
    tick = setInterval(() => {
      const left = limit.remaining();
      timer.textContent = T.remaining(left);
      timer.classList.toggle('soon', left <= 10);
    }, 250);
    meter = startWave(stream, wave);
    if (!meter) wave.remove();
    limit.start(() => rec.state !== 'inactive' && rec.stop());
    rec.start();
  }
  function review() {
    const url = URL.createObjectURL(result.blob);
    const send = h('button', { class: 'primary', onclick: async () => {
      send.disabled = true;
      try { await onSend(result); URL.revokeObjectURL(url); } catch (err) { send.disabled = false; box.append(errorLine(err)); }
    } }, T.send);
    box.replaceChildren(h('p', { class: 'meta' }, T.recorded(sec(result.durationSec))), player(url, result.durationSec),
      h('div', { class: 'row' }, send, h('button', { onclick: () => { URL.revokeObjectURL(url); start(); } }, T.rerecord)));
  }
  idle();
  return box;
}

// ---- 約束（privacy-terms-draft.md §A と同じ文。英語は下書きの断りを上に出す） ----
// とくに同意をいただく2つ（§H の2・9）は、約束全体の中の見出しにして、入るときの印の文で名前を挙げる（T31）
const consentBox = () => {
  const c = consentFor(lang);
  return h('section', { class: 'card consent', 'aria-labelledby': 'consent-title' },
    h('h3', { id: 'consent-title' }, c.title),
    c.draftNote ? h('p', { class: 'draft', role: 'note' }, c.draftNote) : null,
    c.sections.flatMap(([title, lines]) => [h('h4', {}, title), h('ul', {}, lines.map((l) => h('li', {}, l)))]),
    h('h4', {}, c.separateTitle), h('ul', {}, c.separate.map(([, l]) => h('li', {}, l))));
};

// 社内のノート・声のログだけに足す「社内で使うときの約束」（diary-promise.mjs・log-promise.mjs）と使い方の案内
const workPromiseBox = (m) => {
  const d = m === 'log' ? logPromiseFor(lang) : diaryPromiseFor(lang);
  const note = consentFor(lang).draftNote;
  return h('section', { class: 'card consent' }, h('h3', {}, d.title),
    note ? h('p', { class: 'draft', role: 'note' }, note) : null,
    h('ol', {}, d.items.map((l) => h('li', {}, l))),
    h('h4', {}, d.guideTitle), h('ul', {}, d.guide.map((l) => h('li', {}, l))));
};

// ---- 入る（F1）。約束を読んで同意しないと入れない。どちらの言語で読んだかも残す ----
// T31: 1画面で「入る」まで届くように、上は3行の要約だけ。約束の全文は「くわしく読む」を開くと読める（消さない）。
// T34: メールの欄は無い（受け取らない）。聞くのは表示名だけ
// 印は、約束全体に1つ（とくに同意をいただく2つの名前を挙げる）と、交換日記なら社内で使うときの約束に1つ
async function joinView(invite) {
  const info = await backend.inviteInfo(invite);
  const diary = info.mode === 'diary';
  const log = info.mode === 'log';
  const name = h('input', { type: 'text', id: 'name', maxlength: 20, required: true, autocomplete: 'nickname' });
  const agree = h('input', { type: 'checkbox', id: 'agree', required: true });
  const agreePromise = diary || log ? h('input', { type: 'checkbox', id: 'agree-promise', required: true }) : null;
  const out = h('div');
  const c = consentFor(lang);
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault();
    if (!agree.checked) return out.replaceChildren(errorLine(new Error(T.mustAgree)));
    if (agreePromise && !agreePromise.checked) return out.replaceChildren(errorLine(new Error(T.mustAgreePromise)));
    try {
      await backend.join({ invite, displayName: name.value, consent: CONSENT_VERSION, consentLang: lang,
        promise: diary ? DIARY_PROMISE_VERSION : log ? LOG_PROMISE_VERSION : undefined });
      // 招待の文字列を URL から消す（join の隣の ./ へ。GitHub Pages ではサブフォルダ /toi-voice/）。
      // 社内のノート・声のログは、はじめに通知のチュートリアルを出す（T36。「あとで」で飛ばせる）
      history.replaceState(null, '', `${new URL('./', location.href).pathname}${diary || log ? '#/notify' : '#/'}`);
      mode = null;
      route();
    } catch (err) { out.replaceChildren(errorLine(err)); }
  } },
  h('label', { for: 'name' }, T.nameLabel), name,
  h('label', { class: 'check' }, agree, T.agreeLabel),
  agreePromise ? h('label', { class: 'check' }, agreePromise, log ? T.logAgreeLabel : T.nbAgreeLabel) : null,
  h('div', { class: 'row' }, h('button', { class: 'primary', type: 'submit' }, T.joinButton)), out);
  show(h('h2', {}, diary ? T.nbJoinTitle(info.name) : log ? T.logJoinTitle(info.name) : T.joinTitle),
    h('p', { class: 'meta' }, diary ? T.nbJoinIntro : log ? T.logJoinIntro : T.joinIntro),
    h('section', { class: 'card summary', 'aria-labelledby': 'summary-title' }, h('h3', { id: 'summary-title' }, T.summaryTitle),
      c.draftNote ? h('p', { class: 'draft', role: 'note' }, c.draftNote) : null,
      h('ol', {}, (diary ? diarySummaryFor(lang) : log ? logSummaryFor(lang) : c.summary).map((l) => h('li', {}, l)))),
    h('details', { class: 'full' }, h('summary', {}, T.readFull), consentBox(), diary || log ? workPromiseBox(info.mode) : null),
    form);
}

// 1冊目のはじめに置く見本のページ（T31）。運営の見本と明記し、保存の層には入れない（冊子にも数にも入らない）
const samplePage = () => {
  const s = diarySampleFor(lang);
  return h('section', { class: 'card sample', 'aria-labelledby': 'sample-title' },
    h('h3', { id: 'sample-title' }, T.nbSampleTitle),
    h('p', { class: 'meta', role: 'note' }, s.label),
    h('p', { class: 'sample-card' }, s.card),
    h('p', {}, s.text),
    h('ul', { class: 'plain replies' }, h('li', {}, s.margin)),
    h('p', { class: 'meta' }, s.how));
};

// ---- 自分のこと（表示名を直す・約束を読み直す・抜けて全部消す） ----
function selfSection(me) {
  const name = h('input', { type: 'text', maxlength: 20, value: me.displayName, 'aria-label': T.renameAria });
  const out = h('div');
  const leave = async () => {
    if (!confirm(T.leaveConfirm)) return;
    try {
      await backend.leave();
      mode = null;
      document.getElementById('who').textContent = '';
      show(h('p', { role: 'status' }, T.leftDone));
    } catch (err) { out.replaceChildren(errorLine(err)); }
  };
  return h('section', { class: 'self' }, h('h2', {}, T.selfTitle),
    h('div', { class: 'row' }, name, h('button', { class: 'small', onclick: async () => {
      try { await backend.rename(name.value); route(); } catch (err) { out.replaceChildren(errorLine(err)); }
    } }, T.renameButton)),
    me.mode === 'diary' || me.mode === 'log' ? h('p', {}, h('a', { href: '#/notify' }, T.notifyMeLink)) : null,
    h('details', {}, h('summary', {}, T.readConsent), consentBox()),
    me.mode === 'diary' || me.mode === 'log' ? h('details', {}, h('summary', {}, me.mode === 'log' ? T.logReadPromise : T.nbReadPromise), workPromiseBox(me.mode)) : null,
    h('div', { class: 'row' }, h('button', { class: 'small danger', onclick: leave }, T.leaveButton)),
    out);
}

// ---- 問いの一覧とお知らせ（F2・F6） ----
async function homeView() {
  const me = await backend.me();
  mode = me.mode;
  if (me.mode === 'diary') return notebookView(me);
  if (me.mode === 'log') return logHomeView(me);
  const [prompts, keep, collection] = await Promise.all([backend.prompts(),
    backend.keepList().catch(() => ({ open: false })), backend.collection().catch(() => null)]);
  setWho(me);
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
  const log = (await currentMode()) === 'log';
  const reload = () => promptView(id);
  const tabs = log ? logTabBar(null, null) : null;
  const head = [h('p', { class: log ? 'back' : null }, h('a', { href: '#/' }, log ? T.logBack : T.backToList)), h('h2', {}, v.prompt.text)];
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
      recorder(60, async (audio) => { await backend.answer(id, { kind: 'voice', audio }); reload(); }, log ? T.logRecord : T.answerVoice, { big: log }),
      h('details', {}, h('summary', {}, T.answerText), h('label', { for: 'answer-text' }, T.textMax), text,
        h('div', { class: 'row' }, h('button', { onclick: guard(() => backend.answer(id, { kind: 'text', text: text.value })) }, T.sendText))),
      h('div', { class: 'row' }, h('button', { onclick: guard(() => backend.answer(id, { kind: 'pass' })) }, T.pass)),
      out];
    // 締め切りの前は答える画面だけ。後は答える画面の下に仲間の声も出す
    if (!v.afterDeadline) return show(...head, ...form, tabs);
    head.push(...form);
  }
  const del = (fn, msg) => async () => { if (confirm(msg)) { await fn(); reload(); } };
  const items = v.voices.map((x) => {
    const replyText = h('input', { type: 'text', maxlength: 140, 'aria-label': T.replyAria, placeholder: T.replyPlaceholder });
    const out = h('div');
    const act = (fn) => async () => { try { await fn(); reload(); } catch (err) { out.replaceChildren(errorLine(err)); } };
    return h('li', { class: 'card' },
      h('div', { class: 'meta' }, T.voiceMeta(byName(x.by), x.mine, x.kind === 'voice' ? T.voiceLen(sec(x.durationSec)) : T.kindLabels.text)),
      x.kind === 'voice' ? audioEl('voice', x) : h('p', {}, x.text),
      h('div', { class: 'row' },
        x.mine ? h('span', { class: 'meta' }, T.marksMine(x.marks))
          : h('button', { class: 'small', disabled: x.markedByMe, onclick: act(() => backend.reply(x.id, { kind: 'mark' }, { promptId: id })) }, x.markedByMe ? T.markDone(x.marks) : T.mark(x.marks)),
        x.mine ? h('button', { class: 'small', onclick: del(() => backend.deleteVoice(x.id), T.deleteVoiceConfirm) }, T.deleteButton) : null,
        // 講座で紹介してよい（S10）: 押した声だけ運営者が聞ける。いつでも外せる
        x.mine ? h('button', { class: 'small', onclick: act(() => backend.setShare(x.id, !x.shared)) }, x.shared ? T.shareOn : T.shareOff) : null),
      x.replies.length ? h('ul', { class: 'plain replies' }, x.replies.map((r) => h('li', {},
        h('span', { class: 'meta' }, T.replyBy(byName(r.by))),
        r.kind === 'voice' ? audioEl('reply', r) : r.text,
        r.mine ? h('button', { class: 'small', onclick: del(() => backend.deleteReply(r.id), T.deleteReplyConfirm) }, T.deleteButton) : null))) : null,
      h('details', {}, h('summary', {}, T.replyToggle),
        h('div', { class: 'row' }, replyText, h('button', { class: 'small', onclick: act(() => backend.reply(x.id, { kind: 'text', text: replyText.value }, { promptId: id })) }, T.send)),
        recorder(30, async (audio) => { await backend.reply(x.id, { kind: 'voice', audio }, { promptId: id }); reload(); }, T.replyVoice)),
      out);
  });
  show(...head,
    v.myAnswer?.kind === 'pass' ? h('p', { class: 'meta' }, T.passed, h('button', { class: 'small', onclick: del(() => backend.deleteVoice(v.myAnswer.id), T.undoPassConfirm) }, T.undoPass)) : null,
    v.voices.length ? h('ul', { class: 'plain' }, items) : h('p', {}, T.noVoices),
    tabs);
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
      h('div', { class: 'meta' }, T.collectionItem(x.position, x.prompt, byName(x.by))),
      x.kind === 'voice' ? audioEl('voice', x) : h('p', {}, x.text)))));
}

// ---- 交換日記版（mvp-spec §7）: ノートの画面・書き手の画面・ページと余白・冊子の棚 ----
// 誰がノートを持っているか・順番・誰がお休みしたかは、どの画面にも出さない（D-2・D-3）
// T35（work/ui-patterns.md）: 下のタブ（ノート・書く・棚・自分）で、1画面に主な行動を1つ。説明は1行。
// 空の値（null・undefined・NaN・不正な日付）は、その部分ごと出さない（test/screens.test.mjs が全画面を描いて確かめる）
const toNotebook = () => h('p', { class: 'back' }, h('a', { href: '#/' }, T.nbBack));
const validTime = (t) => has(t) && !Number.isNaN(new Date(t).getTime());
const when = (t) => (validTime(t) ? new Date(t).toLocaleString(T.htmlLang, { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const pageLen = (x) => (x.kind === 'voice' ? (has(x.durationSec) ? T.voiceLen(sec(x.durationSec)) : T.kindLabels.voice) : T.kindLabels.text);
const pageTitle = (x) => x.cardText || (x.follows ? T.nbFollowed : T.nbFree);
// 書いた本人が付けた見出し（T33）があれば大きく出し、カードの問いはその下に小さく
const pageHead = (x) => x.title || pageTitle(x);
const cardLine = (x) => (x.title ? h('p', { class: 'meta card-line' }, pageTitle(x)) : null);
// 一覧の下の小さな行: 長さと、0 でない数だけ（「余白 0」は出さない）
const pageMeta = (x) => [pageLen(x), x.margins?.length ? T.nbMargins(x.margins.length) : null, x.marks ? T.nbMarks(x.marks) : null].filter(Boolean).join(' · ');
const volumeName = (n, state) => (!has(n) ? T.nbShelfTitle : T.nbVolumeStates[state] ? T.nbVolumeLabel(n, T.nbVolumeStates[state]) : T.nbCoverVolume(n));

// 1ページの紙（T32）: 上に日付、下に書き手の名前。日付は日まで（時刻は出さない）
const day = (t) => new Date(t).toLocaleDateString(T.htmlLang, { month: 'short', day: 'numeric', weekday: 'short' });
const dateLine = (t) => (validTime(t) ? h('time', { class: 'date', datetime: new Date(t).toISOString() }, day(t)) : null);
const sign = (x) => h('span', { class: 'sign' }, T.nbSign(byName(x.by), x.mine));

// 自分の番の知らせ（T32）: 画面のいちばん上に大きく「あなたの番です（残り◯時間）」。残りは切り上げで、1時間を切っても1と出す
const HOUR = 60 * 60 * 1000;
const hoursLeft = (dueAt) => (validTime(dueAt) ? Math.max(1, Math.ceil((new Date(dueAt).getTime() - Date.now()) / HOUR)) : null);
function turnBanner(nb, { link = true } = {}) {
  if (!nb.myTurn) return null;
  const left = hoursLeft(nb.turn?.dueAt);
  const body = [h('strong', {}, left == null ? T.nbTurnNow : T.nbTurnBanner(left)), h('span', {}, nb.turn?.remind ? T.nbTurnRemind : T.nbTurnHint)];
  return link ? h('a', { class: 'turn', href: '#/write' }, body) : h('div', { class: 'turn', role: 'status' }, body);
}
// 渡す・受け取るの1行（封筒の印は飾り。読み上げない）
const handoff = (attrs, ...children) => h('div', { class: 'handoff', ...attrs }, h('span', { class: 'mark', 'aria-hidden': 'true' }, '✉'), h('p', {}, ...children));
// 空の画面の一言（状態ごと）。次の行動があれば1つだけ下に
const empty = (text, ...action) => h('div', { class: 'empty' }, h('p', {}, text), ...action);

// 下のタブ（どの画面でも同じ並び）。due のタブに点（自分の番・まだ答えていない問い）
function tabNav(tabs, active, due, aria) {
  return h('nav', { class: 'tabs', 'aria-label': aria }, tabs.map(([href, icon, label]) =>
    h('a', { href, 'aria-current': href === active ? 'page' : null, class: href === due ? 'due' : null },
      h('span', { class: 'icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'label' }, label))));
}
// 交換日記: 4つ。自分の番のときは「書く」に点
const tabBar = (active, nb) => tabNav([['#/', '📖', T.nbTabNotebook], ['#/write', '🎙', T.nbTabWrite], ['#/books', '📚', T.nbTabShelf], ['#/me', '🙂', T.nbTabMe]],
  active, nb?.myTurn ? '#/write' : null, T.nbTabsAria);

async function notebookView(me) {
  const nb = await backend.notebook();
  setWho(me);
  document.getElementById('footer').textContent = T.nbFooter;
  const notices = [
    ...(nb.binding ?? []).filter((b) => b.myPages && b.id).map((b) => h('li', { class: 'card notice' }, h('a', { href: `#/book/${b.id}` }, T.nbNoticeBind))),
    ...(nb.notices ?? []).filter((n) => n.pageId).map((n) => h('li', { class: 'card notice' }, h('a', { href: `#/page/${n.pageId}` }, n.kind === 'mark' ? T.nbNoticeMark : T.nbNoticeMargin))),
  ];
  const pages = nb.pages ?? [];
  // 番でないときの一言（状態ごと）。休み中は「また書く」が主な行動
  const status = nb.resting ? empty(T.nbResting, h('button', { class: 'small', onclick: async () => { await backend.resumeTurns(); route(); } }, T.nbResume))
    : nb.state === 'waiting' ? empty(T.nbWaiting)
      : nb.state === 'stopped' ? empty(T.nbStopped)
        : nb.myTurn ? null : h('p', { class: 'meta wait' }, T.nbWaitTurn);
  show(
    turnBanner(nb),
    status,
    notices.length ? h('ul', { class: 'plain' }, notices) : null,
    (nb.binding ?? []).filter((b) => b.id && has(b.number)).map((b) => h('p', { class: 'card' }, h('a', { href: `#/book/${b.id}` },
      validTime(b.reviewEndsAt) ? T.nbBindingLink(b.number, when(b.reviewEndsAt)) : T.nbBound(b.number)))),
    h('div', { class: 'nb-head' }, h('h2', {}, has(nb.notebook?.name) ? nb.notebook.name : T.nbUntitled),
      has(nb.volume?.number) ? h('span', { class: 'meta' }, T.nbVolumeNow(nb.volume.number, pages.length)) : null),
    pages.length ? h('ul', { class: 'plain' }, pages.map((x) => h('li', { class: 'page' },
      dateLine(x.createdAt),
      h('a', { class: 'title', href: `#/page/${x.id}` }, pageHead(x)),
      cardLine(x),
      x.kind === 'text' && has(x.text) ? h('p', { class: 'body' }, x.text) : null,
      sign(x),
      h('div', { class: 'meta' }, pageMeta(x)))))
      // まだページが無い: 1冊目なら書き方の見本を出す
      : [!nb.volume || nb.volume.number === 1 ? samplePage() : null, nb.state === 'running' ? empty(T.nbNoPages) : null],
    tabBar('#/', nb),
  );
}

// 自分（タブの4つ目）: 表示名・約束を読む・仲間を招く・抜ける。ノートの画面から移した（T35）
async function meView() {
  const me = await backend.me();
  setWho(me);
  if (me.mode !== 'diary' && me.mode !== 'log') return show(selfSection(me));
  const log = me.mode === 'log';
  const nb = log ? null : await backend.notebook().catch(() => null);
  const lg = log ? await backend.log().catch(() => null) : null;
  const out = h('div');
  const renew = async () => {
    try {
      const r = await backend.renewInvite();
      out.replaceChildren(h('p', { class: 'meta' }, T.nbInviteNew), h('code', {}, `${new URL('join', location.href.split('#')[0])}#${r.invite}`));
    } catch (err) { out.replaceChildren(errorLine(err)); }
  };
  show(
    h('section', { class: 'invite' }, h('h2', {}, T.nbInviteToggle), h('p', { class: 'meta' }, T.nbInviteHint),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: renew }, T.nbInviteButton)), out),
    selfSection(me),
    log ? logTabBar('#/me', lg) : tabBar('#/me', nb),
  );
}

// 書き手の画面（自分の番のときだけ）: 前の人から届いたページ → カードを引くか自由に → 声か文字で書いて渡す／お休み
// T35: 主な行動は大きな丸い録音ボタン1つ。何を書くかは3つの札から選ぶだけ。文字・お休みは下に小さく
async function writeView() {
  const nb = await backend.notebook();
  if (!nb.myTurn) return show(empty(T.nbNotYourTurn), tabBar('#/write', nb));
  let choice = { cardId: null, follows: false };
  const chosen = h('p', { class: 'meta chosen', 'aria-live': 'polite' }, T.nbFreeChosen);
  const cardsBox = h('div');
  const out = h('div');
  const from = has(nb.turn?.from?.name) ? nb.turn.from : null;
  const chips = [];
  const chip = (label, onclick) => { const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: () => { chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b))); onclick(); } }, label); chips.push(b); return b; };
  const pick = (c, label) => { choice = c; chosen.textContent = label; };
  const draw = async () => {
    try {
      const cards = await backend.drawCards();
      cardsBox.replaceChildren(h('ul', { class: 'plain cards' }, cards.filter((c) => has(c.text)).map((c) => h('li', {},
        h('button', { class: 'card-pick', type: 'button', onclick: () => pick({ cardId: c.id, follows: false }, T.nbCardChosen(c.text)) }, c.text)))));
    } catch (err) { cardsBox.replaceChildren(errorLine(err)); }
  };
  // 渡した直後の小さな祝い（work/ui-patterns.md の6）。封筒が少し動く。動きを減らす設定では止まる（style.css）
  const done = () => show(h('div', { class: 'handed', role: 'status' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, '✉'),
    h('h2', {}, T.nbHandedTitle), h('p', {}, T.nbHanded)), h('p', { class: 'center' }, h('a', { class: 'button', href: '#/' }, T.nbBack)), tabBar('#/write', null));
  // 見出し（T33）: 書いた本人が付ける一行。なくてもよい。声でも文字でも同じ欄を使う
  const title = h('input', { type: 'text', id: 'page-title', maxlength: 20, autocomplete: 'off', placeholder: T.nbTitlePlaceholder });
  const write = async (input) => { await backend.writePage(input, { ...choice, title: title.value.trim() || null }); done(); };
  const text = h('textarea', { rows: 5, maxlength: 400, id: 'page-text' });
  const free = chip(T.nbFree, () => { cardsBox.replaceChildren(); pick({ cardId: null, follows: false }, T.nbFreeChosen); });
  free.setAttribute('aria-pressed', 'true');
  show(turnBanner(nb, { link: false }),
    handoff({}, from ? [T.nbFrom(from.name), from.pageId ? [' ', h('a', { href: `#/page/${from.pageId}` }, T.nbReadIt)] : null] : T.nbNewVolume),
    h('div', { class: 'chips', role: 'group', 'aria-label': T.nbHowTitle },
      chip(T.nbDraw, draw), free,
      from ? chip(T.nbFollow, () => { cardsBox.replaceChildren(); pick({ cardId: null, follows: true }, T.nbFollowChosen(from.name)); }) : null),
    cardsBox, chosen,
    h('label', { for: 'page-title' }, T.nbTitleLabel), title,
    recorder(60, (audio) => write({ kind: 'voice', audio }), T.nbWriteVoice, { big: true }),
    h('details', {}, h('summary', {}, T.nbWriteText), h('label', { for: 'page-text' }, T.textMax), text,
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: async () => {
        try { await write({ kind: 'text', text: text.value }); } catch (err) { out.replaceChildren(errorLine(err)); }
      } }, T.nbHandOff))),
    h('div', { class: 'row end' }, h('button', { class: 'quiet', title: T.nbSkipHint, onclick: async () => {
      if (!confirm(T.nbSkipConfirm)) return;
      try { await backend.skipTurn(); done(); } catch (err) { out.replaceChildren(errorLine(err)); }
    } }, T.nbSkip)),
    out,
    tabBar('#/write', nb));
}

// 1ページと余白。余白を書くとき「冊子に入れてよい」を選べる（既定は入れない）
async function notebookPageView(id) {
  const x = await backend.page(id);
  const reload = () => notebookPageView(id);
  const out = h('div');
  const act = (fn) => async () => { try { await fn(); reload(); } catch (err) { out.replaceChildren(errorLine(err)); } };
  const del = (fn, msg) => async () => { if (confirm(msg)) await act(fn)(); };
  const vol = x.volume ?? {};
  const open = vol.state !== 'released';
  const margins = x.margins ?? [];
  const marginText = h('input', { type: 'text', maxlength: 140, 'aria-label': T.replyAria, placeholder: T.nbMarginPlaceholder });
  const inBook = h('input', { type: 'checkbox' });
  const marks = Number(x.marks) || 0;
  show(toNotebook(),
    h('article', { class: 'page' },
      dateLine(x.createdAt),
      h('h2', {}, pageHead(x)),
      cardLine(x),
      x.kind === 'voice' ? audioEl('page', x) : h('p', { class: 'body' }, x.text ?? ''),
      sign(x),
      has(vol.number) ? h('div', { class: 'meta' }, volumeName(vol.number, vol.state)) : null),
    h('div', { class: 'row' },
      x.mine ? (marks ? h('span', { class: 'meta' }, T.marksMine(marks)) : null)
        : h('button', { class: 'small mark-btn', disabled: x.markedByMe || !open, onclick: act(() => backend.margin(id, { kind: 'mark' })) }, x.markedByMe ? T.markDone(marks) : T.mark(marks)),
      x.mine ? h('button', { class: 'small quiet', onclick: async () => {
        if (!confirm(T.nbDeletePageConfirm)) return;
        try { await backend.deletePage(id); location.hash = '#/'; } catch (err) { out.replaceChildren(errorLine(err)); }
      } }, T.deleteButton) : null),
    h('h3', {}, T.nbMarginsTitle),
    margins.length ? h('ul', { class: 'plain replies' }, margins.map((r) => h('li', {},
      h('span', { class: 'meta' }, T.replyBy(byName(r.by))),
      r.kind === 'voice' ? audioEl('margin', r) : (r.text ?? ''),
      r.mine && open ? h('button', { class: 'small', onclick: act(() => backend.setMarginInBook(r.id, !r.inBook)) }, r.inBook ? T.nbInBookOn : T.nbInBookOff) : null,
      r.mine ? h('button', { class: 'small quiet', onclick: del(() => backend.deleteMargin(r.id), T.nbDeleteMarginConfirm) }, T.deleteButton) : null)))
      : h('p', { class: 'meta' }, open ? T.nbNoMargins : T.nbNoMarginsClosed),
    // 主な行動: 余白に一言（声でも）
    open ? h('section', { class: 'margin-form' },
      h('div', { class: 'row' }, marginText, h('button', { class: 'primary', onclick: act(() => backend.margin(id, { kind: 'text', text: marginText.value }, { inBook: inBook.checked })) }, T.send)),
      h('label', { class: 'check' }, inBook, T.nbInBookLabel),
      recorder(30, async (audio) => { await backend.margin(id, { kind: 'voice', audio }, { inBook: inBook.checked }); reload(); }, T.nbMarginVoice)) : null,
    out,
    tabBar('#/', null));
}

// 冊子の棚: 綴じた冊が並ぶ（ノートの「たまっていく記録」）
// 表紙（T32）: 「◯冊目」を大きく、ノートの名前・ページ数・いまの状態を小さく
async function shelfView() {
  const [list, nb] = await Promise.all([backend.books(), backend.notebook()]);
  const name = has(nb.notebook?.name) ? nb.notebook.name : T.nbUntitled;
  const books = (list ?? []).filter((b) => b.id && has(b.number));
  show(turnBanner(nb), h('h2', {}, T.nbShelfTitle),
    books.length ? h('ul', { class: 'shelf' }, books.map((b) => h('li', {},
      h('a', { href: `#/book/${b.id}`, 'aria-label': `${name} ${volumeName(b.number, b.state)}` },
        h('span', { class: 'vol' }, T.nbCoverVolume(b.number)),
        h('span', { class: 'name' }, name),
        h('span', { class: 'state' }, [has(b.pages) ? T.nbBookPages(b.pages) : null, T.nbVolumeStates[b.state]].filter(Boolean).join(' · ')))))) : empty(T.nbShelfEmpty),
    tabBar('#/books', nb));
}

// 1冊の冊子。確かめの間は、自分のページを残すか選べる（何も選ばなくてよい）
async function bookView(id) {
  const b = await backend.book(id);
  const reload = () => bookView(id);
  const out = h('div');
  const items = b.items ?? [];
  show(h('p', { class: 'back' }, h('a', { href: '#/books' }, T.nbBackShelf)),
    h('h2', {}, volumeName(b.number, b.state)),
    b.state === 'review' ? h('p', { class: 'meta' }, validTime(b.reviewEndsAt) ? T.nbReviewHint(when(b.reviewEndsAt)) : T.nbReviewHintNoDate) : null,
    b.mine ? h('section', {}, h('h3', {}, T.nbKeepTitle),
      b.mine.length ? h('ul', { class: 'plain' }, b.mine.map((p) => h('li', { class: 'card' },
        p.title ? h('strong', {}, p.title) : null,
        h('div', { class: 'meta' }, pageTitle(p), ' · ', pageLen(p)),
        p.kind === 'text' && has(p.text) ? h('p', {}, p.text) : null,
        h('button', { class: 'small', onclick: async () => {
          try { await backend.setPageKeep(p.id, !p.keep); reload(); } catch (err) { out.replaceChildren(errorLine(err)); }
        } }, p.keep ? T.keepOn : T.nbKeepOff)))) : h('p', { class: 'meta' }, T.nbNoMyPages)) : null,
    out,
    h('h3', {}, T.nbBookTitle),
    items.length ? h('ul', { class: 'plain' }, items.map((x) => h('li', { class: 'page' },
      dateLine(x.createdAt),
      h('span', { class: 'title' }, pageHead(x)),
      cardLine(x),
      x.kind === 'voice' ? audioEl('page', x) : h('p', { class: 'body' }, x.text ?? ''),
      sign(x),
      x.margins?.length ? h('ul', { class: 'plain replies' }, x.margins.map((r) => h('li', {},
        h('span', { class: 'meta' }, T.replyBy(byName(r.by))), r.kind === 'voice' ? audioEl('margin', r) : (r.text ?? '')))) : null))) : empty(T.nbBookEmpty),
    tabBar('#/books', null));
}

// 通知のチュートリアル（T36・notify.mjs）: 機種ごとに「置く → 開く → 許可」の3枚。下に、いまの状態と「通知を受け取る」を1つ。
// はじめて入ったあとに出し、あとから「自分」の画面のリンクでもう一度見られる。iPhone はホーム画面から開いたときだけ許可を聞ける
const vapidKey = () => document.querySelector?.(`meta[name="${VAPID_META}"]`)?.getAttribute('content')?.trim() ?? '';
let notifyPlatform = null;
async function notifyView() {
  const log = (await currentMode()) === 'log';
  const nb = log ? null : await backend.notebook().catch(() => null);
  const lg = log ? await backend.log().catch(() => null) : null;
  const platform = notifyPlatform ?? platformOf(navigator.userAgent);
  // 公開の鍵: Supabase 版は関数 push_public_key から（Edge Function が作って Vault に置いたもの）。meta はローカルの試し用
  const publicKey = vapidKey() || (await backend.pushKey().catch(() => null)) || '';
  const win = globalThis;
  const out = h('div');
  const state = await pushState({ win, publicKey });
  const act = (fn) => async () => { try { await fn(); notifyView(); } catch (err) { out.replaceChildren(errorLine(err)); } };
  const action = state === 'off' ? h('button', { class: 'primary', type: 'button', onclick: act(() => turnOn({ win, publicKey, lang, save: (s) => backend.savePush(s) })) }, T.notifyOn)
    : state === 'on' ? h('button', { class: 'small quiet', type: 'button', onclick: act(() => turnOff({ win, remove: (e) => backend.deletePush(e) })) }, T.notifyOff)
      : null;
  const steps = T.notifySteps[platform];
  show(h('h2', {}, T.notifyTitle), h('p', { class: 'meta' }, log ? T.notifyIntroLog : T.notifyIntro),
    h('div', { class: 'chips', role: 'group', 'aria-label': T.notifyPlatformAria }, PLATFORMS.map((p) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(p === platform), onclick: () => { notifyPlatform = p; notifyView(); } }, T.notifyPlatforms[p]))),
    h('ol', { class: 'plain tutorial' }, TUTORIAL[platform].map((img, i) => h('li', { class: 'card step' },
      h('img', { src: img, alt: '', width: 120, height: 144 }),
      h('div', {}, h('span', { class: 'meta' }, T.notifyStep(i + 1, steps.length)), h('h3', {}, steps[i][0]), h('p', {}, steps[i][1]))))),
    h('section', { class: 'notify-now', 'aria-live': 'polite' }, T.notifyStates[state] ? h('p', { role: 'status' }, T.notifyStates[state]) : null,
      action ? h('div', { class: 'row center' }, action) : null, out),
    h('p', { class: 'center' }, h('a', { href: '#/' }, T.notifyLater)),
    log ? logTabBar('#/me', lg) : nb ? tabBar('#/me', nb) : null);
}

// ---- 声のログ版（社内向け・2026-10-25 本人「VoiceLog の方向性で」） ----
// 1画面目は「今日の問い」に大きな丸い録音ボタンで答える → 下に、聞ける声が新しい順にたまっていく（ログ）。
// 答える（パスも）と、その問いへの仲間の声が聞ける（R-1）。順番・持ち時間・冊は無い
const logTabBar = (active, lg) => tabNav([['#/', '🎧', T.logTabLog], ['#/answer', '🎙', T.logTabAnswer], ['#/me', '🙂', T.logTabMe]],
  active, lg?.open?.length ? '#/answer' : null, T.logTabsAria);
const initial = (name) => [...String(name)][0] ?? '';

// 今日の問い: いちばん新しい、まだ答えていない問いに、その場で答える。文字・パスは下に小さく。ほかに答えていない問いは畳んで出す
function todayCard(lg, after) {
  const p = (lg.open ?? []).find((x) => x.id && has(x.text));
  if (!p) {
    return h('section', { class: 'card today done' }, h('p', {}, T.logAllDone),
      h('p', { class: 'meta' }, validTime(lg.nextOpensAt) ? T.logNext(when(lg.nextOpensAt)) : T.logNoNext));
  }
  const out = h('div');
  const text = h('textarea', { rows: 4, maxlength: 400, id: 'answer-text' });
  const send = async (input) => { await backend.answer(p.id, input); after(); };
  const guard = (fn) => async () => { try { await fn(); } catch (err) { out.replaceChildren(errorLine(err)); } };
  const others = (lg.open ?? []).filter((x) => x.id && has(x.text) && x.id !== p.id);
  return h('section', { class: 'card today', 'aria-labelledby': 'today-title' },
    h('p', { class: 'meta', id: 'today-title' }, T.logToday),
    h('h2', { class: 'question' }, p.text),
    h('p', { class: 'meta' }, T.logUnlock),
    recorder(60, (audio) => send({ kind: 'voice', audio }), T.logRecord, { big: true }),
    h('details', {}, h('summary', {}, T.answerText), h('label', { for: 'answer-text' }, T.textMax), text,
      h('div', { class: 'row' }, h('button', { onclick: guard(() => send({ kind: 'text', text: text.value })) }, T.sendText))),
    h('div', { class: 'row end' }, h('button', { class: 'quiet', onclick: guard(() => send({ kind: 'pass' })) }, T.pass)),
    out,
    others.length ? h('details', { class: 'others' }, h('summary', {}, T.logOtherOpen(others.length)),
      h('ul', { class: 'plain' }, others.map((x) => h('li', {}, h('a', { href: `#/p/${x.id}` }, x.text))))) : null);
}

// ログの1件: 誰が・いつ・どの問いに・声（か文字）。「それ知らなかった」と返事はその場から
function logItem(x) {
  const out = h('div');
  const marks = Number(x.marks) || 0;
  const replies = Number(x.replies) || 0;
  const who = x.mine ? T.logMine : byName(x.by);
  const mark = async () => {
    try { await backend.reply(x.id, { kind: 'mark' }, { promptId: x.promptId }); route(); } catch (err) { out.replaceChildren(errorLine(err)); }
  };
  return h('li', { class: 'log-item' },
    h('div', { class: 'speaker' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, initial(who)), h('strong', {}, who),
      validTime(x.createdAt) ? h('time', { class: 'meta', datetime: new Date(x.createdAt).toISOString() }, when(x.createdAt)) : null),
    has(x.prompt) && x.promptId ? h('a', { class: 'q', href: `#/p/${x.promptId}` }, x.prompt) : null,
    x.kind === 'voice' ? audioEl('voice', x) : h('p', { class: 'body' }, x.text ?? ''),
    h('div', { class: 'row' },
      x.mine ? (marks ? h('span', { class: 'meta' }, T.marksMine(marks)) : null)
        : h('button', { class: 'small mark-btn', disabled: !!x.markedByMe, onclick: mark }, x.markedByMe ? T.markDone(marks) : T.mark(marks)),
      x.promptId ? h('a', { class: 'reply-link', href: `#/p/${x.promptId}` }, replies ? T.logReplies(replies) : T.logOpenVoice) : null),
    out);
}

// まだ聞ける声が無いときの見本（運営の見本と明記し、保存の層には入れない）
const logSample = () => {
  const s = logSampleFor(lang);
  return h('section', { class: 'card sample', 'aria-labelledby': 'log-sample-title' },
    h('h3', { id: 'log-sample-title' }, T.logSampleTitle),
    h('p', { class: 'meta', role: 'note' }, s.label),
    h('p', { class: 'sample-card' }, s.prompt),
    h('p', {}, h('strong', {}, s.by), ' ', s.text),
    h('ul', { class: 'plain replies' }, h('li', {}, s.reply)),
    h('p', { class: 'meta' }, s.how));
};

async function logHomeView(me) {
  const lg = await backend.log();
  setWho(me);
  document.getElementById('footer').textContent = T.logFooter;
  const feed = (lg.feed ?? []).filter((x) => x.id);
  const seen = new Set();
  const notices = (lg.notices ?? []).filter((n) => n.promptId && !seen.has(`${n.kind}:${n.promptId}`) && seen.add(`${n.kind}:${n.promptId}`));
  show(
    h('div', { class: 'nb-head' }, h('h2', {}, has(lg.log?.name) ? lg.log.name : T.logTabLog)),
    notices.length ? h('ul', { class: 'plain' }, notices.map((n) => h('li', { class: 'card notice' },
      h('a', { href: `#/p/${n.promptId}` }, n.kind === 'mark' ? T.logNoticeMark : T.logNoticeReply)))) : null,
    todayCard(lg, route),
    h('h3', { class: 'feed-title' }, T.logFeedTitle),
    feed.length ? h('ul', { class: 'plain log' }, feed.map(logItem)) : [h('p', { class: 'meta' }, T.logEmpty), logSample()],
    logTabBar('#/', lg));
}

// 「答える」のタブ: 今日の問いだけ。答えたらログへ
async function logAnswerView() {
  const lg = await backend.log();
  document.getElementById('footer').textContent = T.logFooter;
  show(todayCard(lg, () => { location.hash = '#/'; }),
    Number(lg.answered) ? h('p', { class: 'meta center' }, T.logAnsweredCount(Number(lg.answered))) : null,
    logTabBar('#/answer', lg));
}

async function route() {
  try {
    if (location.hash === '#/notify') return await notifyView();
    if (location.hash === '#/keep') return await keepView();
    if (location.hash === '#/collection') return await collectionView();
    if (location.hash === '#/write') return await writeView();
    if (location.hash === '#/answer') return await logAnswerView();
    if (location.hash === '#/books') return await shelfView();
    if (location.hash === '#/me') return await meView();
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
// ホーム画面に置けるように（T32）。service worker は画面のファイルだけを持ち、ノートの中身（問い合わせ・音声・Supabase）は持たない（sw.js）
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // 新しい版の service worker が入れ替わったら、1回だけ読み直す（古い画面のまま新しい保存の層を使わない・2026-10-25）。
  // はじめて置いたとき（前の service worker が無い）は読み直さない
  const updating = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updating && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js').catch(() => { /* 置けなくても、いつもどおり開ける */ });
}
try {
  backend = await chooseBackend();
  addEventListener('hashchange', route);
  route();
} catch (err) {
  show(errorLine(err));
}
