// 日本語・英語の文言。端末の言語が日本語なら日本語、それ以外は英語（タイトル画面で切り替えられる）
const DICT = {
  ja: {
    'doc.title': '外苑いちょう並木　最後の一葉',
    'title.sub': '明治神宮外苑・晩秋',
    'title.name': '外苑いちょう並木',
    'title.name2': '最後の一葉',
    'title.story': '7日間でイチョウの葉をどれだけ残せるか？',
    'title.start': '並木を歩きはじめる',
    'title.howto': '遊び方',
    'title.note': '落ち葉が地面に着く前につかむと、願いが叶うとも言われています。',
    'title.best': 'ベスト記録：7日目まで葉が残った木 <b>{n}本</b>',
    'legal.privacy': 'プライバシーポリシー',
    'legal.adSettings': '広告の設定',
    'url.privacy': 'https://techgym.jp/privacy-policy/',
    'howto.url': 'howto.html',
    'hud.festival': 'いちょう祭り',
    'hud.left': 'のこり',
    'hud.leaves': '並木の葉',
    'hud.alive': '葉のある木',
    'hud.restored': 'よみがえらせた木',
    'hud.caught': 'つかんだ葉',
    'hud.days': '{n}日',
    'hud.day': '{d}日目 {t}',
    'hud.climb': '木登り中（幹へ進むと登る・離れる方向で降りる / Space:幹を蹴ってジャンプ）',
    'hud.climbTouch': '木登り中（スティックを幹へ倒すと登る・離れる方向で降りる／ジャンプで幹を蹴る）',
    'hud.gauge': 'ジャンプ（Space：押し続けるほど高く上がる）',
    'hud.gaugeTouch': 'ジャンプ（長押しで高く）',
    'hud.hint': '枯れかけた木には光る玉が出る。触れるとよみがえる！（根元・てっぺん・幹の途中）',
    'hud.hintTouch': '枯れかけた木には光る玉が出る。触れるとよみがえる！',
    'btn.jump': 'ジャンプ',
    'btn.bgmOn': '♪ BGM オン', 'btn.bgmOff': '♪ BGM オフ',
    'pause.title': 'ひと休み', 'pause.resume': 'クリックで再開', 'pause.resumeTouch': '再開', 'btn.toTitle': 'タイトルへ',
    'over.retry': 'もう一度、秋へ', 'over.share': '結果をシェア',
    'redo.title': '危ない！', 'redo.msg': '広告を見て、はねられる少し前からやり直しますか？',
    'redo.watch': '広告を見てやり直す', 'redo.next': 'やり直さない', 'redo.nextN': 'やり直さない（{s}）',
    'redo.note': 'この{days}日間で、あと{n}回やり直せます', 'redo.loading': '広告を読み込み中…', 'redo.fail': '広告を読み込めませんでした',
    'howto.close': '閉じる',
    'phase.peak': '見頃', 'phase.falling': '散りさかり', 'phase.thinning': '落葉すすむ', 'phase.winter': '冬支度', 'phase.last': '最後の一葉',
    'toast.phase': '並木は「{p}」', 'toast.lastLeaf': '最後の一葉を守れ！',
    'toast.gold': '金の葉をつかんだ！ 願いが叶うかも', 'toast.combo': '連続 {n}枚！',
    'toast.restore': '光る玉に触れた！ 紅葉がよみがえる',
    'toast.reviveTomorrow': 'この木はよみがえらせたばかり。また明日', 'toast.reviveN': 'この木はよみがえらせたばかり。あと{n}日',
    'toast.alive': '葉のある木は残り{n}本', 'toast.gust': '木枯らしが吹いた！', 'toast.lightup': '夜のライトアップが始まった',
    'toast.lastDay': 'いちょう祭り 最終日！', 'toast.day': 'いちょう祭り {d}日目　あと{n}日',
    'toast.fallen': '最後の一葉が散った……', 'toast.quality': '動作が重いため「{q}」モードに切り替えました',
    'quality.0': '高画質', 'quality.1': '標準', 'quality.2': '軽量', 'quality.3': '最軽量',
    'rank.c4': 'いちょう並木の守り神', 'rank.c3': '黄金の並木の名人', 'rank.c2': '外苑の庭師', 'rank.c1': '並木の世話人',
    'rank.o1': '通りすがりの散歩人', 'rank.o2': 'いちょう好き', 'rank.o3': '並木の世話人', 'rank.o4': '外苑の庭師', 'rank.o5': 'いちょう並木の守り神',
    'over.subClear': 'いちょう祭りの7日間を守り切った！', 'over.subCar': '車道で車にぶつかってしまった', 'over.subWinter': '最後の一葉が散りました',
    'over.titleClear': '並木は最後まで黄金色', 'over.titleCar': '危ない！ 車にはねられた', 'over.titleWinter': '並木に冬が来た',
    'res.leftLabel': '7日目の終わりに、葉が残っていた木', 'res.trees': '{n}本', 'res.of146': ' ／146本',
    'res.leftPct': '残った葉　<b>{p}%</b>（並木全体で、満開のときの何%か）',
    'res.stats': 'よみがえらせた木 <b>{r}</b> 本 ／ つかんだ葉 <b>{c}</b>（金の葉 {g}枚）',
    'res.statsShort': 'よみがえらせた木 <b>{r}</b> 本 ／ つかんだ葉 <b>{c}</b>',
    'res.rank': '称号：{r}', 'res.redo': 'やり直し {n}回',
    'res.timeLabel': '並木の秋を守った時間', 'res.time': '{d}日と{h}時間',
    'res.leftShort': '葉が残っていた木 <b>{n}本</b> ／ 残った葉 <b>{p}%</b>',
    'share.title': '外苑いちょう並木　最後の一葉', 'share.dialog': '結果をシェア',
    'share.clear': '外苑いちょう並木　最後の一葉で、いちょう祭りの7日間を守り切った！ 葉が残った木は{n}本／146本（称号：{r}）',
    'share.over': '外苑いちょう並木　最後の一葉で、並木の秋を{d}日と{h}時間守った！',
    'share.redo': '　やり直し{n}回',
  },
  en: {
    'doc.title': 'Ginkgo Avenue: The Last Leaf',
    'title.sub': 'Late autumn in a Tokyo park',
    'title.name': 'Ginkgo Avenue',
    'title.name2': 'The Last Leaf',
    'title.story': 'How many ginkgo trees can you keep golden for 7 days?',
    'title.start': 'Start walking',
    'title.howto': 'How to play',
    'title.note': 'They say that if you catch a falling leaf before it touches the ground, your wish will come true.',
    'title.best': 'Best: <b>{n} trees</b> still had leaves on day 7',
    'legal.privacy': 'Privacy policy',
    'legal.adSettings': 'Ad settings',
    'url.privacy': 'https://techgym.jp/privacy-policy-en/',
    'howto.url': 'howto-en.html',
    'hud.festival': 'Festival',
    'hud.left': 'Days left',
    'hud.leaves': 'Leaves',
    'hud.alive': 'Leafy trees',
    'hud.restored': 'Revived',
    'hud.caught': 'Leaves caught',
    'hud.days': '{n}',
    'hud.day': 'Day {d} {t}',
    'hud.climb': 'Climbing (move toward the trunk to climb, away to go down / Space: kick off and jump)',
    'hud.climbTouch': 'Climbing (push the stick toward the trunk to climb, away to go down / Jump: kick off)',
    'hud.gauge': 'Jump (hold Space to go higher)',
    'hud.gaugeTouch': 'Jump (hold to go higher)',
    'hud.hint': 'Withering trees show a glowing orb. Touch it to revive the tree! (roots, top or halfway up)',
    'hud.hintTouch': 'Withering trees show a glowing orb. Touch it to revive the tree!',
    'btn.jump': 'Jump',
    'btn.bgmOn': '♪ Music on', 'btn.bgmOff': '♪ Music off',
    'pause.title': 'Paused', 'pause.resume': 'Click to resume', 'pause.resumeTouch': 'Resume', 'btn.toTitle': 'Title',
    'over.retry': 'Play again', 'over.share': 'Share result',
    'redo.title': 'Watch out!', 'redo.msg': 'Watch an ad to go back to just before you were hit?',
    'redo.watch': 'Watch an ad and retry', 'redo.next': 'No thanks', 'redo.nextN': 'No thanks ({s})',
    'redo.note': '{n} retries left in these {days} days', 'redo.loading': 'Loading the ad…', 'redo.fail': 'The ad could not be loaded',
    'howto.close': 'Close',
    'phase.peak': 'Peak colors', 'phase.falling': 'Falling fast', 'phase.thinning': 'Thinning out', 'phase.winter': 'Almost winter', 'phase.last': 'The last leaf',
    'toast.phase': 'The avenue: {p}', 'toast.lastLeaf': 'Save the last leaf!',
    'toast.gold': 'You caught a golden leaf! Make a wish', 'toast.combo': '{n} in a row!',
    'toast.restore': 'You touched the orb! The tree turns golden again',
    'toast.reviveTomorrow': 'You just revived this tree. Try again tomorrow', 'toast.reviveN': 'You just revived this tree. Try again in {n} days',
    'toast.alive': '{n} trees still have leaves', 'toast.gust': 'A cold wind blows!', 'toast.lightup': 'The evening light-up has begun',
    'toast.lastDay': 'Last day of the festival!', 'toast.day': 'Festival day {d}, {n} days left',
    'toast.fallen': 'The last leaf has fallen…', 'toast.quality': 'Switched to "{q}" mode because the game was running slowly',
    'quality.0': 'High', 'quality.1': 'Standard', 'quality.2': 'Light', 'quality.3': 'Lightest',
    'rank.c4': 'Guardian of the Ginkgo Avenue', 'rank.c3': 'Master of the Golden Avenue', 'rank.c2': 'Park Gardener', 'rank.c1': 'Tree Keeper',
    'rank.o1': 'Passing Stroller', 'rank.o2': 'Ginkgo Lover', 'rank.o3': 'Tree Keeper', 'rank.o4': 'Park Gardener', 'rank.o5': 'Guardian of the Ginkgo Avenue',
    'over.subClear': 'You protected the avenue for all 7 festival days!', 'over.subCar': 'You ran into a car on the road', 'over.subWinter': 'The last leaf has fallen',
    'over.titleClear': 'Golden to the very end', 'over.titleCar': 'Ouch! Hit by a car', 'over.titleWinter': 'Winter has come',
    'res.leftLabel': 'Trees with leaves at the end of day 7', 'res.trees': '{n}', 'res.of146': ' / 146 trees',
    'res.leftPct': 'Leaves left: <b>{p}%</b> (of the whole avenue at its peak)',
    'res.stats': 'Trees revived <b>{r}</b> / Leaves caught <b>{c}</b> (golden: {g})',
    'res.statsShort': 'Trees revived <b>{r}</b> / Leaves caught <b>{c}</b>',
    'res.rank': 'Title: {r}', 'res.redo': 'Retries: {n}',
    'res.timeLabel': 'How long you kept autumn alive', 'res.time': '{d} days {h} hours',
    'res.leftShort': 'Trees with leaves <b>{n}</b> / Leaves left <b>{p}%</b>',
    'share.title': 'Ginkgo Avenue: The Last Leaf', 'share.dialog': 'Share your result',
    'share.clear': 'In Ginkgo Avenue: The Last Leaf, I protected the avenue for all 7 days! {n} of 146 trees still had leaves (Title: {r})',
    'share.over': 'In Ginkgo Avenue: The Last Leaf, I kept autumn alive for {d} days {h} hours!',
    'share.redo': ' (retries: {n})',
  },
};

function detect() {
  try { const s = localStorage.getItem('icho-lang'); if (s === 'ja' || s === 'en') return s; } catch {}
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ja'];
  return /^ja\b/i.test(langs[0] || '') ? 'ja' : 'en';
}
export let LANG = detect();
export function t(key, vars = {}) {
  let s = (DICT[LANG] && DICT[LANG][key]) ?? DICT.ja[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
// data-i18n（文字）・data-i18n-href（リンク先）の付いた要素を、今の言語で書き換える
export function applyStatic(root = document) {
  document.documentElement.lang = LANG;
  document.title = t('doc.title');
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-href]').forEach((el) => { el.setAttribute('href', t(el.dataset.i18nHref)); });
  document.querySelectorAll('.langBtn').forEach((b) => b.classList.toggle('on', b.dataset.lang === LANG));
}
export function setLang(l) {
  LANG = l;
  try { localStorage.setItem('icho-lang', l); } catch {}
  applyStatic();
}
