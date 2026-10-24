// 交換日記版（work/mvp-spec.md §7-7）の「社内で使うときの約束」10項目と、書き方の案内（§7-5）。
// 交換日記のノートに入るときだけ、シーズン版の約束（consent.mjs）に足して見せる。
// 正本は mvp-spec §7-7 の表（privacy-terms-draft.md に入れるのは T25 の後）。文を変えたら DIARY_PROMISE_VERSION を上げる。
// 英語は下書き・専門家の確認前（consent.mjs の CONSENT_DRAFT_NOTE_EN を上に出す）。
// T31: 10項目の文は変えず、入る画面に3行の要約と、この約束だけの印を足した（それまでは約束全体の印に含めていた）
export const DIARY_PROMISE_VERSION = '2026-10-24-diary-draft-2';

export const DIARY_PROMISE = {
  ja: {
    title: '交換日記のノートを社内で使うときの約束',
    items: [
      '会社（代表・上司・人事）は、ノートの中身を見る役割を持ちません。代表や上司も1人の書き手として、ほかの人と同じ画面だけを使います',
      '書いたこと・書かなかったこと・パス・余白を、評価・人事・業務の報告に使いません。入らないこと、抜けることで不利になりません',
      'ノートは日報・業務の連絡・報告の場にしません。業務の指示や催促をノートに書きません',
      '誰が書いたか・パスしたか・いつ書いたか・数は、会社に渡しません。たいどが数えるのは、このアプリを良くするための、ノートごとの合計だけです',
      'ノートの中身を、社内報・社内チャット・社外に持ち出さないでください（画面の写しも）。社内報などに使うのは、書いた本人が書面で許した言葉だけです',
      '声や文字を AI で分析して、会社に返しません。AI の学習に使いません',
      '残さなかったページと余白は、冊を綴じて確かめの間が終わったら消えます。自分のページと余白はいつでも消せます。抜けたら全部消えます。配った後の冊子は、受け取った人の手元からは消せません',
      '困った書き込みは、受け取った人が「知らせる」で、たいどにだけ出せます。たいどが中身を見るのは、その知らせで出された分だけです。会社には知らせません',
      '勤務時間中に書いてよいか、会社の端末で使ってよいかは、会社が先に決めて全員に伝えてください（個人のスマホでも使えます）',
      '声を社外のサービス（置き場所はプライバシーポリシー第7条）に置いてよいかを、会社の情報システムの決まりで先に確かめてください',
    ],
    guideTitle: '書き方の案内（全員に同じ文で）',
    guide: [
      '業務の指示・評価・報告の催促をノートに書かない',
      '仲間のページに業務の話で余白を返さない',
    ],
  },
  en: {
    title: 'The promise for using the notebook at work',
    items: [
      'The company (executives, managers, HR) has no role that lets it see what\'s in the notebook. Executives and managers take part as writers, with exactly the same screens as everyone else.',
      'What you write, don\'t write, skip, or reply is never used for evaluation, HR decisions, or work reporting. Not joining, or leaving, has no consequences.',
      'The notebook is not for daily reports, work updates, or instructions. Please don\'t use it to assign or chase work.',
      'We never give the company who wrote, who skipped, when, or any counts. Taido only counts per-notebook totals, to improve the app.',
      'Please don\'t copy notebook content into newsletters, chat, or anywhere outside (screenshots included). Only words the writer has agreed to in writing may be reused.',
      'We don\'t analyze voices or text with AI for the company, and we don\'t use them to train AI.',
      'Pages and margin notes you don\'t keep are deleted when a volume is bound and the review period ends. You can delete your own pages and notes at any time, and everything is deleted when you leave. Bound books already handed out can\'t be removed from other members\' devices.',
      'If something written makes you uncomfortable, you can report it to Taido only. Taido looks only at content reported this way, and does not tell the company.',
      'The company should decide, and tell everyone in advance, whether writing during work hours or on company devices is OK. (It also works on personal phones.)',
      'Please check in advance that your company\'s IT policy allows voices to be stored with an outside service (where: Privacy Policy, Article 7).',
    ],
    guideTitle: 'How to write (the same note for everyone)',
    guide: [
      'Don\'t use the notebook to give work instructions, evaluations, or chase reports',
      'Don\'t reply in the margins about work',
    ],
  },
};

// 交換日記の入る画面のいちばん上の3行の要約（T31）。約束（consent.mjs と上の10項目）の言葉から取り、足さない
export const DIARY_SUMMARY = {
  ja: [
    '声と文字は、同じノートの仲間だけが聞けます・読めます。会社には、中身を見る役割がありません',
    '書いた・書かない・パスを、評価・人事・業務の報告に使いません。誰が書いたかも会社に渡しません',
    '残さなかったページは、冊を綴じて確かめの間が終わると消えます。自分のページはいつでも消せます',
  ],
  en: [
    'Voices and text can be heard and read only by the people in the same notebook. The company has no role that lets it see them',
    'What you write, don\'t write, or skip is never used for evaluation, HR, or work reporting. We never tell the company who wrote',
    'Pages you don\'t keep are deleted when a volume is bound and the review period ends. You can delete your own pages at any time',
  ],
};

// 1冊目のはじめに置く見本のページ（T31・本人 2026-10-24 の5）。運営が作った見本で、本物の声ではない。
// 画面（app.mjs）が出すだけで、保存の層（store.mjs・schema.sql）には入れない。だから冊子にも数にも入らない
export const DIARY_SAMPLE = {
  ja: {
    label: '見本のページ — 運営（たいど）が作った見本です。本物の声ではなく、冊子にも数にも入りません',
    card: '最近、ちょっとうれしかった小さな発見は？',
    text: '先週から、朝のコーヒーの豆を手で挽いています。はじめは粉が飛び散りましたが、いまは音でちょうどいい細かさが分かります。みなさんの小さな発見も聞きたいです。',
    margin: '音で分かるの、知らなかった！ 今度その音を聞かせてください',
    how: 'カードを引くか自由に → 60秒までの声か、短い文字で1ページ → 次の人へ渡す。仲間のページには、余白に一言か声で返せます',
  },
  en: {
    label: 'Sample page — made by Taido as an example. It is not a real voice, and it is not part of any book or count',
    card: 'What small discovery made you happy recently?',
    text: 'Since last week I\'ve been grinding my morning coffee beans by hand. At first the grounds went everywhere, but now I can tell the right size by the sound. I\'d love to hear your small discoveries too.',
    margin: 'Telling by the sound — I didn\'t know that! Let me hear it some time',
    how: 'Draw a card or write freely → one page as a voice note of up to 60 seconds or a few lines of text → pass it on. You can leave a note or a voice in the margin of other people\'s pages',
  },
};

export const diaryPromiseFor = (lang) => DIARY_PROMISE[lang === 'en' ? 'en' : 'ja'];
export const diarySummaryFor = (lang) => DIARY_SUMMARY[lang === 'en' ? 'en' : 'ja'];
export const diarySampleFor = (lang) => DIARY_SAMPLE[lang === 'en' ? 'en' : 'ja'];
