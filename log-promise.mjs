// 声のログ版（社内向け・2026-10-25 本人「VoiceLog の方向性で」）の「社内で使うときの約束」10項目と、入る画面の3行・見本。
// 交換日記版（diary-promise.mjs）の約束から、順番・冊・綴じるの話を外し、問いに声で答えて聞き合う形に合わせた。
// 声のログに入るときだけ、シーズン版の約束（consent.mjs）に足して見せる。文を変えたら LOG_PROMISE_VERSION を上げる
// （schema.sql の private.log_promise_version と同じ。test/log.test.mjs が突き合わせる）。英語は下書き・専門家の確認前。
export const LOG_PROMISE_VERSION = '2026-10-25-log-draft-1';

export const LOG_PROMISE = {
  ja: {
    title: '声のログを社内で使うときの約束',
    items: [
      '会社（代表・上司・人事）は、ログの中身を見る役割を持ちません。代表や上司も1人の答え手として、ほかの人と同じ画面だけを使います',
      '答えたこと・答えなかったこと・パス・返事を、評価・人事・業務の報告に使いません。入らないこと、抜けることで不利になりません',
      'ログは日報・業務の連絡・報告の場にしません。業務の指示や催促をログに書きません',
      '誰が答えたか・パスしたか・いつ答えたか・数は、会社に渡しません。たいどが数えるのは、このアプリを良くするための、問いごとの合計だけです',
      'ログの中身を、社内報・社内チャット・社外に持ち出さないでください（画面の写しも）。社内報などに使うのは、答えた本人が書面で許した言葉だけです',
      '声や文字を AI で分析して、会社に返しません。AI の学習に使いません',
      '自分の声・文字・返事はいつでも消せます。抜けたら全部消えます。誰も使わなくなったログは、最後に答えがあってから180日で全部消えます',
      '困った書き込みは、聞いた人が「知らせる」で、たいどにだけ出せます。たいどが中身を見るのは、その知らせで出された分だけです。会社には知らせません',
      '勤務時間中に答えてよいか、会社の端末で使ってよいかは、会社が先に決めて全員に伝えてください（個人のスマホでも使えます）',
      '声を社外のサービス（置き場所はプライバシーポリシー第7条）に置いてよいかを、会社の情報システムの決まりで先に確かめてください',
    ],
    guideTitle: '使い方の案内（全員に同じ文で）',
    guide: [
      '業務の指示・評価・報告の催促をログに書かない',
      '仲間の声に業務の話で返事をしない',
    ],
  },
  en: {
    title: 'The promise for using the voice log at work',
    items: [
      'The company (executives, managers, HR) has no role that lets it see what\'s in the log. Executives and managers take part as members, with exactly the same screens as everyone else.',
      'What you answer, don\'t answer, skip, or reply is never used for evaluation, HR decisions, or work reporting. Not joining, or leaving, has no consequences.',
      'The log is not for daily reports, work updates, or instructions. Please don\'t use it to assign or chase work.',
      'We never give the company who answered, who skipped, when, or any counts. Taido only counts per-question totals, to improve the app.',
      'Please don\'t copy log content into newsletters, chat, or anywhere outside (screenshots included). Only words the speaker has agreed to in writing may be reused.',
      'We don\'t analyze voices or text with AI for the company, and we don\'t use them to train AI.',
      'You can delete your own voices, text and replies at any time, and everything is deleted when you leave. A log nobody uses is deleted entirely 180 days after its last answer.',
      'If something makes you uncomfortable, you can report it to Taido only. Taido looks only at content reported this way, and does not tell the company.',
      'The company should decide, and tell everyone in advance, whether answering during work hours or on company devices is OK. (It also works on personal phones.)',
      'Please check in advance that your company\'s IT policy allows voices to be stored with an outside service (where: Privacy Policy, Article 7).',
    ],
    guideTitle: 'How to use it (the same note for everyone)',
    guide: [
      'Don\'t use the log to give work instructions, evaluations, or chase reports',
      'Don\'t reply to someone\'s voice about work',
    ],
  },
};

// 入る画面のいちばん上の3行の要約。約束（consent.mjs と上の10項目）の言葉から取り、足さない
export const LOG_SUMMARY = {
  ja: [
    '声と文字は、同じログの仲間だけが聞けます・読めます。会社には、中身を見る役割がありません',
    '答えた・答えない・パスを、評価・人事・業務の報告に使いません。誰が答えたかも会社に渡しません',
    '自分が答えると、その問いへの仲間の声が聞けます。自分の声はいつでも消せます',
  ],
  en: [
    'Voices and text can be heard and read only by the people in the same log. The company has no role that lets it see them',
    'What you answer, don\'t answer, or skip is never used for evaluation, HR, or work reporting. We never tell the company who answered',
    'Once you answer a question, you can hear everyone\'s answers to it. You can delete your own voice at any time',
  ],
};

// まだ誰の声も聞けないときに出す見本（運営が作った見本で、本物の声ではない。保存の層には入れない）
export const LOG_SAMPLE = {
  ja: {
    label: '見本 — 運営（たいど）が作った見本です。本物の声ではありません',
    prompt: '最近、ちょっとうれしかった小さな発見は？',
    by: 'たいど',
    text: '先週から、朝のコーヒーの豆を手で挽いています。はじめは粉が飛び散りましたが、いまは音でちょうどいい細かさが分かります。',
    reply: '音で分かるの、知らなかった！',
    how: '問いが届いたら、60秒までの声か短い文字で答える → 答えると、その問いへの仲間の声が聞ける → 「それ知らなかった」か一言で返す',
  },
  en: {
    label: 'Sample — made by Taido as an example. It is not a real voice',
    prompt: 'What small discovery made you happy recently?',
    by: 'Taido',
    text: 'Since last week I\'ve been grinding my morning coffee beans by hand. At first the grounds went everywhere, but now I can tell the right size by the sound.',
    reply: 'Telling by the sound — I didn\'t know that!',
    how: 'When a question arrives, answer with up to 60 seconds of voice or a few lines → once you answer, you can hear everyone\'s answers → reply with "I didn\'t know that" or a few words',
  },
};

export const logPromiseFor = (lang) => LOG_PROMISE[lang === 'en' ? 'en' : 'ja'];
export const logSummaryFor = (lang) => LOG_SUMMARY[lang === 'en' ? 'en' : 'ja'];
export const logSampleFor = (lang) => LOG_SAMPLE[lang === 'en' ? 'en' : 'ja'];
