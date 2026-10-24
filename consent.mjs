// 入るときに見せる約束。work/privacy-terms-draft.md §A と同じ言葉にする（test/consent.test.mjs が突き合わせる）。
// 文を変えたら CONSENT_VERSION を上げる。入った人の記録には、同意した版が残る。
// supabase/schema.sql の private.consent_version() も同じ値にする（test/schema.test.mjs が突き合わせる）
// 2026-10-24（T25）: シーズン制と本人の決定（AIOS toi-voice DECISIONS 2026-10-24）に揃えた。privacy-terms-draft.md §H の10項目
export const CONSENT_VERSION = '2026-10-24-season-1';

export const CONSENT_TITLE = '「問いと声」の約束 — あなたの声の扱い';

export const CONSENT = [
  ['だれがやっているの？', [
    '「たいど」がやっています（運営: [本人: 名義]）。申し込んで料金を払うのは、あなたが入っている講座・研修・コミュニティの運営者です。あなたが払うものはありません',
    'あなたは招待のリンクから自分で登録します。たいどは運営者から名簿を受け取りません。あなたの声と記録は、運営者の代わりではなく、たいどがあなたから直接預かります',
  ]],
  ['仲間に聞こえるもの', [
    'あなたの声・文字の答え・返事は、同じグループの人だけが聞けます・読めます。表示名と一緒に出ます',
    '問いが開いてから [本人: 48時間] は、その問いに答えた（かパスした）人だけが聞けます。そのあとは、グループの全員が聞けます',
    'グループに講師や職場の上司がいるときは、その人も1人の仲間として聞けます（ほかの人より多くは見えません）',
    'パスしたこと・「それ知らなかった」を誰が押したか・先に答える番に誰が当たったかは、仲間には出ません（印は数だけ）',
  ]],
  ['運営者に渡すもの・渡さないもの', [
    '運営者に渡すのは数だけです。運営者のグループ全部をまとめた数で、全部で [本人: 20人] 以上のときは週ごと、それより少ないときはシーズンの終わりの1枚だけです。[本人: 5] 未満の数は伏せます',
    'あなたの声・文字・返事の中身、あなたが答えたかどうか、表示名・メール、通報があったこと、あなたが抜けたことは、運営者に渡しません。運営者が求めても、人ごとの数は出しません',
    '運営者にも会社にも、声の中身を見る画面や役割はありません。例外は、あなたが自分の声に「講座で紹介してよい」を押したときで、その声だけを運営者が聞けます。いつでも外せて、外すとその場で聞けなくなります',
    '会社が研修として申し込んだときも、会社は運営者と同じ扱いで、数だけを受け取ります',
    'ただ、10人ほどのグループなので、数から誰かを推し量れることがあります。少ない数は伏せるようにします',
  ]],
  ['たいどが聞くとき', [
    'たいども、あなたの声を聞きません。聞くのは、声を受け取った仲間が「困る」と通報して、自分から出した声だけです。聞いたら、日付と理由を記録します（声の中身は写しません）',
    '通報でたいどが聞くことには、この約束とは別の欄で同意をいただきます（下の「別の欄で同意をいただくこと」）',
    '困ったとき・相談したいときの窓口は、どの画面でもいちばん下に出ています',
  ]],
  ['使わないこと', [
    '声と文字を、宣伝・事例・研究・AI の学習に使いません',
    '声を文字にするのは、あなたが自分の声について頼んだときだけです。結果はあなたの画面にだけ出ます。声を AI で分析することはしません',
    '声の中身を、講座の採点・成績や、会社の評価・仕事の報告に使わせません',
    'メールはお知らせにだけ使います（仲間にも運営者にも見せません）',
    '問い合わせに AI が最初に答えるときも、AI に渡すのは問い合わせの文だけです',
  ]],
  ['残すこと・消すこと', [
    '自分の声・文字・返事は、いつでも自分で消せます。声を消すと、その声への仲間の返事も一緒に消えます',
    '最終週に、自分の声から「知らなかった集」に入れるものを選べます。何も選ばなくてかまいません。配る前の [本人: 3日] は、集の中身を見て、自分の声を外せます',
    '配った「知らなかった集」は、グループの人の手元に残ります。配ったあとは、手元のものを消すことはできません',
    'シーズンの終わりに、自分の声と答えをまとめて持ち帰れます。サーバーには、シーズンの終わりから [本人: 1年] だけ置き、そのあとすべて消します。ずっと残るわけではありません。残すのは、個人が分からない数だけです',
    '途中でやめたいとき、自分の記録を全部消したいときは、画面のいちばん下の「抜けて、自分の記録を全部消す」から、いつでもすぐに消せます（配ったあとの「知らなかった集」は除きます）。このノートを始めた人へ に頼むこともできます',
  ]],
  ['参加は自由です', [
    '参加しなくてもかまいません。途中でやめてもかまいません。参加しないこと・やめることで、講座の成績や仕事の上での不利はありません（運営者にもそう約束してもらっています）。',
  ]],
  ['書かないでほしいこと', [
    '人の名前や、その場にいない人が特定されること・病気や家のことなど人に知られたくないこと（自分のことでも、無理に話さなくてかまいません）・人を傷つけること。',
  ]],
];

// 約束とは別の欄で、1つずつ印を付けてもらう同意（§H の2・9）。どれも印が無いと入れない【T25 の仮。§F の2・8】
// 入った人の記録には、印を付けた id が consentItems として残る
export const CONSENT_SEPARATE_TITLE = '別の欄で同意をいただくこと';

export const CONSENT_SEPARATE = [
  ['report', '通報でたいどが聞くこと: グループの仲間が、ある声を「困る」と通報して出したとき、たいどがその声だけを聞いて、どうするかを決めることに同意します'],
  ['sensitive', '人に知られたくない話: 声や文字に、健康・信条など人に知られたくない事がらが入ることがあります。それが入った声と文字も、この約束のとおりに預かることに同意します（話すかどうかは、自分で決めてかまいません）'],
];

export const CONSENT_ITEM_IDS = CONSENT_SEPARATE.map(([id]) => id);

// 相談の窓口。どの画面でもいちばん下に出す（§H の2）
export const CONSENT_CONTACT = '困ったとき・相談: このノートを始めた人へ';

// 英語版（T20）。CONSENT の訳で、見出しと行の数を同じにする（test/i18n.test.mjs が突き合わせる）。
// 下書きで、専門家の確認の前。英語の画面では CONSENT_DRAFT_NOTE_EN を必ず約束の上に出す。
// 同意した版は日本語と同じ CONSENT_VERSION。どちらの言語で読んだかは、入った人の記録に consentLang として残す
export const CONSENT_DRAFT_NOTE_EN = 'DRAFT — This English text is a draft translation and has not yet been reviewed by a legal professional. If it differs from the Japanese text, the Japanese text applies.';

export const CONSENT_TITLE_EN = 'The "Questions & Voices" promise — how your voice is handled';

export const CONSENT_EN = [
  ['Who runs this?', [
    'It is run by "Taido" (operator: [owner: legal name]). The one who signs up and pays is the organiser of the course, training or community you belong to. You pay nothing',
    'You register yourself from the invitation link. Taido does not receive a list of participants from the organiser. Taido holds your voice and records directly from you, not on behalf of the organiser',
  ]],
  ['What your group can hear', [
    'Your voice notes, text answers and replies can be heard and read only by people in the same group. They are shown with your display name',
    'For [owner: 48 hours] after a question opens, only people who answered (or passed on) that question can hear them. After that, everyone in the group can',
    'If an instructor or your manager at work is in the group, they hear them as one member of the group (they cannot see more than anyone else)',
    'Whether you passed, who pressed "I didn\'t know that", and who was picked to answer first are not shown to the group (only the number of marks)',
  ]],
  ['What is and is not given to the organiser', [
    'The organiser receives only numbers, combined across all of their groups: weekly when they have [owner: 20] or more people in total, otherwise a single sheet at the end of the season. Numbers under [owner: 5] are hidden',
    'The content of your voice, text and replies, whether you answered, your display name and email, whether anything was reported, and whether you left are not given to the organiser. Even if the organiser asks, we do not give numbers per person',
    'Neither the organiser nor any company has a screen or role for seeing the content of voices. The one exception: if you press "OK to share in the course" on one of your own voices, the organiser can hear that voice only. You can undo it at any time, and they lose access immediately',
    'When a company signs up for a training, the company is treated the same as an organiser and receives numbers only',
    'However, because a group is only about 10 people, someone could sometimes be guessed from the numbers. Small numbers are hidden',
  ]],
  ['When Taido listens', [
    'Taido also does not listen to your voice. We listen only to a voice that a group member received and chose to report to us as a problem. When we listen, we record the date and the reason (not the content of the voice)',
    'We ask for your agreement to Taido listening to reported voices in a separate box from this promise (see "Things we ask you to agree to separately" below)',
    'The contact for problems or questions is always shown at the bottom of every screen',
  ]],
  ['What we do not do', [
    'We do not use voices or text for advertising, case studies, research or AI training',
    'A voice is turned into text only when you ask for it for your own voice. The result is shown only on your screen. We do not analyse voices with AI',
    'We do not let the content of voices be used for course grading or marks, or for company evaluations or work reports',
    'Your email is used only for notifications (it is not shown to the group or the organiser)',
    'If an AI gives the first reply to an enquiry, only the text of the enquiry is given to the AI',
  ]],
  ['Keeping and deleting', [
    'You can delete your own voice notes, text and replies at any time. When you delete a voice, the group\'s replies to it are deleted too',
    'In the last week, you can choose which of your voices go into the "Didn\'t Know That" collection. You do not have to choose any. For [owner: 3 days] before it is handed out, you can look at the collection and take your voices out',
    'Once the "Didn\'t Know That" collection is handed out, it stays with the people in the group. After it is handed out, the copies they have cannot be deleted',
    'At the end of the season, you can take home all of your voices and answers in one file. They are kept on the server for only [owner: 1 year] after the end of the season, and then all deleted. They are not kept forever. Only numbers that cannot identify anyone are kept',
    'If you want to stop partway, or want all of your records deleted, you can do it immediately at any time with "Leave and delete all my records" at the bottom of the screen (except a "Didn\'t Know That" collection already handed out). You can also ask the person who started this notebook',
  ]],
  ['Taking part is up to you', [
    'You do not have to take part. You can stop partway. Not taking part or stopping will not disadvantage you in course marks or at work (we also ask the organiser to promise this).',
  ]],
  ['Please do not include', [
    'Other people\'s names or anything that identifies someone who is not present; things you would not want others to know, such as illness or family matters (even about yourself, you never have to talk about them); anything that hurts others.',
  ]],
];

export const CONSENT_SEPARATE_TITLE_EN = 'Things we ask you to agree to separately';

export const CONSENT_SEPARATE_EN = [
  ['report', 'Taido listening to reported voices: when a group member reports a voice to us as a problem, I agree that Taido listens to that voice only and decides what to do'],
  ['sensitive', 'Things you may not want others to know: voices and text may include things such as health or beliefs that people may not want others to know. I agree that voices and text including such things are also held as set out in this promise (whether to talk about them is up to you)'],
];

export const CONSENT_CONTACT_EN = 'Problems or questions: the person who started this notebook';

// 画面の言語に合わせた約束。英語には下書きの断りが付く
export const consentFor = (lang) => (lang === 'en'
  ? { title: CONSENT_TITLE_EN, sections: CONSENT_EN, draftNote: CONSENT_DRAFT_NOTE_EN, separateTitle: CONSENT_SEPARATE_TITLE_EN, separate: CONSENT_SEPARATE_EN, contact: CONSENT_CONTACT_EN }
  : { title: CONSENT_TITLE, sections: CONSENT, draftNote: null, separateTitle: CONSENT_SEPARATE_TITLE, separate: CONSENT_SEPARATE, contact: CONSENT_CONTACT });
