// 講座DBの価格と概要を 2026-09-25 決定の内容へ更新する。
//   node tools/kouza_update_2026-09.mjs           ← ドライラン（差分を出すだけ）
//   node tools/kouza_update_2026-09.mjs --apply   ← 実際に書き込む
//
// 決定の根拠: ../../クロード広場/手相のマヨネリ攻略/引き継ぎ書.md 4-44
//   ・章別は章のボリュームに沿って振り直し、全部キリのよい数字に切り上げ
//   ・単品合計 ¥217,250 / 全7章セット ¥189,200（12.9%引き）
//   ・流年アナログ、デジタル実践 ¥70,000 は「全7章セットには含まない／本講座には含む」
//   ・税抜を1,000円刻みのキレイな数字にし、税込が従来水準を超えないよう組んだ（本人決定 案C）
//   ・このDBの「価格」は税込のテキスト。FL側は税抜入力でサイトが×1.1する
import { readFileSync } from 'node:fs';

(function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB = process.env.NOTION_KOUZA_ID;
const APPLY = process.argv.includes('--apply');

const api = async (path, method, body) => {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j));
  return j;
};

// URLスラッグ → { 価格, 概要 }
const PLAN = {
  'tesou-ch1-gairon': {
    price: '¥4,950',
    desc: '【全章の前提講座】手相とは何かから始め、命術・相術・卜術の3分類における手相の位置づけ、手相が人を映し出す仕組み（脳と手のひらが胎児期の同じ時期に形成される）を押さえます。何から見るかの順序、マークを無理に探さない理由、一般に言われている説との向き合い方、鑑定用の写真の撮り方まで。線を覚える前に土台を作る、すべての章の入口です。',
  },
  'tesou-ch2-tegata-yubi': {
    price: '¥19,800',
    desc: '線を見る前に、手全体を見る。手形の分類と指の役割から、その人の土台を読み取ります。指と丘がどうつながっているかまで扱うので、このあとの丘編・3大線編の読み方が変わります。線だけを追いかけて迷子になる状態を抜け出すための章です。',
  },
  'tesou-ch3-oka': {
    price: '¥24,200',
    desc: '「丘とは何か」から始めます。金星丘・月丘をはじめとする丘の役割、縁の下の力持ちである地丘、太陽丘の中央が凹む理由まで。線を引くエネルギーがどこから来るのかが分かる章で、3大線編の前提になります。',
  },
  'tesou-ch4-sandaisen': {
    price: '¥49,500',
    desc: '感情線・頭脳線・生命線を、長さ／向き／高さといった属性で読み分けます。3大線が複数ある場合の扱い、交差していても関係があるとは限らないこと、感情・思考・行動の三角形、結婚線まで。マスカケは「特別な線」ではなく感情線と頭脳線が重なったものだと、分解して示します。本講座で最もボリュームのある章のひとつです。',
  },
  'tesou-ch5-sonota': {
    price: '¥29,700',
    desc: '手のひらから読み取るエネルギーと、その分配の法則。リソースは多いほうが良いのか、分配を数字でどう読むか、足りているかをどう判定するか。「生命線が複数ある＝体力がある」で終わらせず、リソースの偏りから相談者の悩みを見つけるところまで進みます。',
  },
  'tesou-ch6-ryunen': {
    price: '¥49,500',
    desc: '手相で「時期」を出す技術。生命線の流年と縦軸の流年、基準点の置き方、縦軸の対象になる線・ならない線。出た数字を4つで見比べる手順、ずれをヒアリングで合わせる方法、分岐がリソースを割く先を示すことまで。線の意味だけでは分からない「いつ何が起きたか」を読む章です。本講座で最もボリュームのある章のひとつです。なお作図の実技（アナログ式・デジタル式）は「流年アナログ、デジタル実践」で扱います。',
  },
  'tesou-ch7-nayami': {
    price: '¥39,600',
    desc: '「読めるのに鑑定ができない」を解く章。必要な情報をこちらから取りに行く手順、相性を優先順位をつけて見る方法、離婚の相談で「至った理由」を想定する組み立て。顕在意識と潜在意識のギャップから本来の姿へつなげる流れ、配慮が要る話の伝え方の7原則、年齢を相手の生活の言葉に言い換える方法まで。扱う場面がもっとも多く、節の数では全章で最多の構成です。',
  },
  'tesou-set-all7': {
    price: '¥189,200',
    desc: '手相本講座の全7章（手相学編・手形指編・丘編・３大線編・リソース・その他の線編・流年編・悩みへのアプローチ方法）を、動画でまとめて受講できるセットです。単品合計217,250円のところ189,200円。スライドは全7章あわせて600ページ超え、副読本つき。1対1の質問セッション60分×4回（好きな章で・1年以内）が付き、視聴期間は無期限です。作図の実技「流年アナログ、デジタル実践」は含みません（別途 ¥69,300 で追加できます）。',
  },
  'tesou-ryunen-jissen': {
    price: '¥69,300',
    desc: '教科書どおりの「等間隔」では、その人の手には合いません。手に合わせて目盛りを引くための実践編です。定規や紐を使うアナログ式と、Canva／PCで正確に引くデジタル式の両方を扱います。全7章セット（動画）には含まれない独立コンテンツなので、セットの受講生も追加で受講できます。手相個別フル講座には最初から含まれています。',
  },
  'tesou-kobetsu-full': {
    price: '¥346,500',
    desc: '論理的手相学を、マンツーマンで体系的に習得します。全7章（手相学編・手形指編・丘編・３大線編・リソース・その他の線編・流年編・悩みへのアプローチ方法）に加え、作図の実技「流年アナログ、デジタル実践」まで含む全範囲。目安は全12回・約3ヶ月・1回90分以上で、進み具合に合わせて回数を調整します。スライドは全7章あわせて600ページ超え。副読本と毎回の録画つき。申し込みの前に、無料の個別面談（30〜60分）があります。',
  },
};

const rt = (s) => [{ type: 'text', text: { content: s } }];
const plain = (p) => (p ? (p.rich_text || p.title || []).map((t) => t.plain_text).join('') : '');

let cur, rows = [];
do {
  const r = await api('/databases/' + DB + '/query', 'POST', { page_size: 100, start_cursor: cur });
  rows.push(...r.results);
  cur = r.has_more ? r.next_cursor : null;
} while (cur);

let changed = 0, skipped = 0;
for (const r of rows) {
  const slug = plain(r.properties['URLスラッグ']);
  const want = PLAN[slug];
  if (!want) continue;
  const nowPrice = plain(r.properties['価格']);
  const nowDesc = plain(r.properties['概要']);
  const dPrice = nowPrice !== want.price;
  const dDesc = nowDesc !== want.desc;
  if (!dPrice && !dDesc) { skipped++; continue; }
  changed++;
  console.log('\n■', plain(r.properties['タイトル']), '  (' + slug + ')');
  if (dPrice) console.log('   価格 : ' + nowPrice + '  →  ' + want.price);
  if (dDesc) {
    console.log('   概要 : ' + nowDesc.slice(0, 60) + '…');
    console.log('        →  ' + want.desc.slice(0, 60) + '…');
  }
  if (APPLY) {
    await api('/pages/' + r.id, 'PATCH', {
      properties: { '価格': { rich_text: rt(want.price) }, '概要': { rich_text: rt(want.desc) } },
    });
  }
}

const missing = Object.keys(PLAN).filter((s) => !rows.some((r) => plain(r.properties['URLスラッグ']) === s));
if (missing.length) console.log('\n[!] DBに見つからないスラッグ:', missing.join(', '));

console.log('\n' + (APPLY ? '書き込みました' : 'ドライラン（書き込みなし）') + ': 変更 ' + changed + ' 件 / 変更なし ' + skipped + ' 件');
if (!APPLY) console.log('実際に反映するには --apply を付けて実行してください');
