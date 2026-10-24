// 交換日記版（work/mvp-spec.md §7-7）の「社内で使うときの約束」10項目と、書き方の案内（§7-5）。
// 交換日記のノートに入るときだけ、シーズン版の約束（consent.mjs）に足して見せる。
// 正本は mvp-spec §7-7 の表（privacy-terms-draft.md に入れるのは T25 の後）。文を変えたら DIARY_PROMISE_VERSION を上げる。
// 英語は下書き・専門家の確認前（consent.mjs の CONSENT_DRAFT_NOTE_EN を上に出す）。
export const DIARY_PROMISE_VERSION = '2026-10-24-diary-draft-1';

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

export const diaryPromiseFor = (lang) => DIARY_PROMISE[lang === 'en' ? 'en' : 'ja'];
