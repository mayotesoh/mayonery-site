// 「流年パック」を両サイトの講座DBに作る（無ければ作る／あれば中身を更新）。
//   node tools/ryunen_pack_create.mjs            ← ドライラン
//   node tools/ryunen_pack_create.mjs --apply    ← 作成・更新
//
// 背景（引き継ぎ書 4-47b／4-49）
//   公式LINEに「流年法特別講座はありませんか」という問い合わせが来た。登録直後、
//   動画も講座も知らない段階で流年だけを名指ししている。外部相場でも流年は単体で
//   ¥180,000〜¥200,000 の値が付く領域（西谷・及川遼）。
//
//   ところが実技（流年アナログ・デジタル実践 ¥69,300）には受講前提があり、
//   手相学編 ¥4,950 ＋ 流年編 ¥49,500 を先に買う必要がある＝実際は ¥123,750。
//   「単発で受けられます」と案内しながら12万かかるのが、詰まりの正体だった。
//
//   → 前提は外さない（目盛りの置き方を知らずに引き方だけ習っても引けない）。
//     **売り方のほうを変えて、3つを1つの商品にまとめる。**
import { readFileSync } from 'node:fs';

(function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const APPLY = process.argv.includes('--apply');
const NAME = '手相講座　流年パック';

// 税抜をキレイな数字にし、税込が単品合計より十分安く見える額にする（案C・4-46）
const EXCL = 95000;
const INCL = Math.floor(EXCL * 1.1);        // 104,500
const PARTS = 4950 + 49500 + 69300;         // 123,750
const OFF = (1 - INCL / PARTS) * 100;       // 15.6%
if (INCL !== 104500) throw new Error('税込の計算が合わない: ' + INCL);

const DESC = `流年だけを、いちばん短い道で身につけるためのパックです。手相講座 手相学編・流年編・流年アナログ・デジタル実践の3つをまとめて受講できます。単品合計${PARTS.toLocaleString()}円のところ${INCL.toLocaleString()}円。目盛りをどこに置くか（知識）と、その手に合わせて実際に線を引くか（技術）の両方が入っているので、これだけで「時期が出せる」ところまで行けます。`;

const NOTE = `単品合計 ${PARTS.toLocaleString()}円 → パック ${INCL.toLocaleString()}円（${OFF.toFixed(1)}%お得）。実技は少人数セッション（90分×2回）で、月の開催回数と定員に上限があります。埋まった場合は翌月のご案内になります。流年編（¥49,500）から差額¥55,000で、手相学編（¥4,950）から差額¥99,550でこのパックに進めます（購入から1年以内）。`;

const BODY = [
  '**流年だけを習いたい方のためのパックです。**',
  '手相の時期を出す技術（流年）は、独学でいちばん詰まるところです。目盛りの数字を覚えても、**基準点がずれていれば年齢は出ません。**逆に、基準点の取り方だけ習っても、どこに何歳を置くかを知らなければ引けません。',
  `**この2つは、セットでないと使えるようになりません。** そこで、必要なものを1つにまとめました。`,
  'h: 入っているもの',
  '- **手相講座　手相学編**（動画）── 何から見るかの順序。すべての章の前提になります',
  '- **手相講座　流年編**（動画）── 2種類の流年、対象になる線とならない線、出た数字の確かめ方、ずれの合わせ方',
  '- **流年アナログ・デジタル実践**（実技・少人数セッション 90分×2回）── その手に合わせて、実際に線を引く',
  `単品で買うと合計 ${PARTS.toLocaleString()}円のところ、パックは **${INCL.toLocaleString()}円**（${OFF.toFixed(1)}%お得）です。`,
  'h: 2つの壁を、順番に越えます',
  '- **マクロの壁＝知識** … どこに、何歳の目盛りを置くか。ここは流年編（動画）で越えます',
  '- **ミクロの壁＝技術** … どこに基準点を置くか。ここは実技でないと越えられません',
  '独学で止まるのは、ほとんどがミクロの壁です。**教科書どおりの「等間隔」では、その人の手には合わない**からです。',
  'h: 実技で扱うこと',
  '- 等間隔では合わない理由と、手に合わせるという考え方',
  '- 基準点をどこに取るか ── 手ごとに違う点を、どう決めるか',
  '- **アナログ式** ── 定規や紐を使って、紙と実物で引く方法',
  '- **デジタル式** ── Canva／PCで正確に引く方法。オンライン鑑定・画像鑑定で使えます',
  '- 実際の手で引いてみる演習と、引いた流年から出来事を読み解くところまで',
  '! **Canvaの操作でつまずく方が多いところです。** 円が楕円になっていた、弧ではなく直線を使っていた——そうした理由で何時間もロスするのは、よくあることです。実技では、そこも一緒に潰します。',
  'h: これができると',
  '- 「いつ頃からですか」という質問に、**手から答えられる**ようになります',
  '- **写真からでも流年を出せます**（オンライン鑑定で効きます）',
  '- 出した年齢を相談者に見せられる形にできます。**画像を見せると、鑑定の納得感が変わります**',
  '- 出た年齢が合わなかったときに、慌てずに直せるようになります',
  'h: 受講の条件',
  `- 受講料：**${INCL.toLocaleString()}円**（標準価格・税込）／単品合計 ${PARTS.toLocaleString()}円`,
  '- 形式：動画2章（視聴期間の定めなし）＋ 少人数のオンラインセッション 90分×2回',
  '- お支払い：銀行振込・PayPay',
  '- **実技は月の開催回数と定員に上限があります。** 埋まった場合は翌月のご案内になります',
  '- 返金：動画をお渡しする前なら全額。お渡しした後の返金はありません',
  'h: 払ったぶんは、次に持っていけます',
  '**購入から1年以内なら、差額でひとつ上に進めます。**先に安いところから試して、必要になったら上がる、という進め方ができます。',
  '- **手相講座　流年編（¥49,500）から** … 差額 **¥55,000** でこのパックへ',
  '- **手相講座　手相学編（¥4,950）から** … 差額 **¥99,550** でこのパックへ',
  '- **このパックから手相個別フル講座（¥346,500）へ** … 差額 **¥242,000**',
  '! **まず流年編（動画・¥49,500）だけ、という始め方もできます。** お申し込み後すぐに見られるので、「どこに目盛りを置くか」はその日のうちに分かります。実技が必要になったら、差額 ¥55,000 でこのパックに切り替えてください。合計は ¥104,500 で、最初からパックを買った場合と同じです。',
  'h: すでに講座を受けている方へ',
  '**「手相講座　全7章セット」には、この実技は含まれていません。** セットを受講済みの方は、実技だけを別途（¥69,300）追加できます。',
  '**「手相個別フル講座」には、最初から含まれています。** 追加は不要です。',
];

// ────────────────────────────────────────
const TOKEN_MAYO = process.env.NOTION_API_KEY;
const TOKEN_FL = process.env.NOTION_FL_TOKEN;
const api = async (token, path, method, body) => {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + token, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j).slice(0, 300));
  return j;
};
const rt = (s) => [{ type: 'text', text: { content: s } }];
const plain = (p) => (p ? (p.rich_text || p.title || []).map((x) => x.plain_text).join('') : '');
const rich = (s) => {
  const out = []; const re = /(\*\*[^*]+\*\*)/g; let last = 0, m;
  const push = (t, b) => { if (t) out.push({ type: 'text', text: { content: t }, annotations: { bold: !!b } }); };
  while ((m = re.exec(s))) { push(s.slice(last, m.index)); push(m[0].slice(2, -2), true); last = m.index + m[0].length; }
  push(s.slice(last)); return out.length ? out : rt(s);
};
const block = (l) =>
  l.startsWith('h: ') ? { object: 'block', type: 'heading_3', heading_3: { rich_text: rich(l.slice(3)) } }
  : l.startsWith('- ') ? { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rich(l.slice(2)) } }
  : l.startsWith('! ') ? { object: 'block', type: 'callout', callout: { rich_text: rich(l.slice(2)), icon: { type: 'emoji', emoji: '📌' } } }
  : { object: 'block', type: 'paragraph', paragraph: { rich_text: rich(l) } };

const SITES = [
  { key: 'マヨネリ', token: TOKEN_MAYO, db: process.env.NOTION_KOUZA_ID, nameProp: 'タイトル',
    props: {
      'タイトル': { title: rt(NAME) },
      '概要': { rich_text: rt(DESC) },
      '価格': { rich_text: rt('¥' + INCL.toLocaleString()) },
      'URLスラッグ': { rich_text: rt('tesou-ryunen-pack') },
      'レベル': { multi_select: [{ name: '応用' }] },
      '表示順': { number: 12 },
      'ステータス': { select: { name: '公開' } },
    } },
  { key: 'FL', token: TOKEN_FL, db: '9e653e0af59e47ebb3c1c9d443339e48', nameProp: '講座名',
    props: {
      '講座名': { title: rt(NAME) },
      'コース名': { rich_text: rt('手相 流年パック（動画＋実技）') },
      '説明': { rich_text: rt(DESC) },
      '補足': { rich_text: rt(NOTE) },
      '提供方法': { rich_text: rt('オンライン ／ 動画視聴（2章）＋ 少人数セッション 90分×2回') },
      '期間・時間': { rich_text: rt('動画2章（視聴期間の定めなし）＋ 90分×2回') },
      '非会員価格(税抜き)': { number: EXCL },
      'カテゴリ': { multi_select: [{ name: '実践講座' }] },
      '種別': { select: { name: 'セット' } },
      '占術': { multi_select: [{ name: '手相' }] },
      '担当講師': { relation: [{ id: '39576a17-0aae-803d-a513-d7c2ad942c9d' }] },
      '表示順': { number: 13 },
      '公開': { checkbox: true },
      '決済対象': { checkbox: false },
    } },
];

console.log(`■ ${NAME}`);
console.log(`   税抜 ${EXCL.toLocaleString()} → 税込 ¥${INCL.toLocaleString()}`);
console.log(`   単品合計 ¥${PARTS.toLocaleString()}（手相学編 4,950 ＋ 流年編 49,500 ＋ 実技 69,300）`);
console.log(`   割引 ${OFF.toFixed(1)}%\n`);

for (const site of SITES) {
  if (!site.token) { console.log(`[!] ${site.key}: トークンなし`); continue; }
  let cur, rows = [];
  do {
    const r = await api(site.token, '/databases/' + site.db + '/query', 'POST', { page_size: 100, start_cursor: cur });
    rows.push(...r.results); cur = r.has_more ? r.next_cursor : null;
  } while (cur);
  const found = rows.find((r) => plain(r.properties[site.nameProp]) === NAME);
  console.log(`  ${site.key}: ${found ? '既存を更新' : '新規作成'} ／ 本文 ${BODY.length}ブロック`);
  if (!APPLY) continue;
  let id;
  if (found) { id = found.id; await api(site.token, '/pages/' + id, 'PATCH', { properties: site.props }); }
  else { id = (await api(site.token, '/pages', 'POST', { parent: { database_id: site.db }, properties: site.props })).id; }
  const old = await api(site.token, '/blocks/' + id + '/children?page_size=100');
  for (const b of old.results || []) await api(site.token, '/blocks/' + b.id, 'PATCH', { archived: true });
  const blocks = BODY.map(block);
  for (let i = 0; i < blocks.length; i += 100) await api(site.token, '/blocks/' + id + '/children', 'PATCH', { children: blocks.slice(i, i + 100) });
  console.log('     → 書き込みました');
}

console.log('\n' + (APPLY ? '完了' : 'ドライラン（書き込みなし）'));
if (!APPLY) console.log('反映するには --apply を付けてください');
