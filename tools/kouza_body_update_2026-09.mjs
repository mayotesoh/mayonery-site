// 講座DBの「ページ本文」に残っている旧価格・旧記述を直す。
//   node tools/kouza_body_update_2026-09.mjs           ← ドライラン
//   node tools/kouza_body_update_2026-09.mjs --apply   ← 実際に書き込む
//
// ※ kouza_update_2026-09.mjs はプロパティ（価格・概要）だけを直す。
//    /kouza/[slug] の詳細ページは **Notionページの本文ブロック** を表示するので、
//    本文を直さないと旧価格が公開されたまま残る。2026-09-25 にこれで取りこぼした。
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
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j));
  return j;
};

// 本文にそのまま現れる文字列の置換。順番に当てるので、長いものを先に書く。
const SUBS = [
  // 受講料の行（章別）
  ['受講料：¥5,000（標準価格・税込）', '受講料：¥4,950（標準価格・税込）'],
  ['受講料：¥19,800（標準価格・税込）', '受講料：¥19,800（標準価格・税込）'],
  ['受講料：¥29,800（標準価格・税込）', '受講料：¥24,200（標準価格・税込）'],
  ['受講料：¥69,800（標準価格・税込）', '受講料：¥69,300（標準価格・税込）'],
  ['受講料：¥168,000（標準価格・税込）', '受講料：¥189,200（標準価格・税込）'],
  ['受講料：¥350,000（標準価格・税込）', '受講料：¥346,500（標準価格・税込）'],
  // セット・単品合計
  ['単品合計213,800円のところ168,000円', '単品合計217,250円のところ189,200円'],
  ['単品合計 213,800円 → セット 168,000円', '単品合計 217,250円 → セット 189,200円'],
  // 教材のページ数（本人指示：正確なページ数は書かない）
  ['章ごとのスライド（約400ページ）', '章ごとのスライド（全7章で600ページ超え）'],
  // 全6章 → 全7章、流年実践の扱い
  ['手相本講座（全6章）には含まれない独立コンテンツのため、本講座の受講生も追加で受講できます。',
   '全7章セット（動画）には含まれない独立コンテンツのため、セットの受講生も追加で受講できます。手相個別フル講座には最初から含まれています。'],
  ['手相本講座（全6章）の範囲外のため、本講座受講生も追加受講が可能。',
   '全7章セット（動画）の範囲外のため、セットの受講生は追加受講が可能。手相個別フル講座には含まれています。'],
  ['（手相学編・手形指編・丘編・３大線編・その他の線編・流年編・悩みへのアプローチ方法）',
   '（手相学編・手形指編・丘編・３大線編・リソース・その他の線編・流年編・悩みへのアプローチ方法）'],
];

// 章別の ¥39,800 は章ごとに行き先が違うので、スラッグで決める
const CH39800 = {
  'tesou-ch4-sandaisen': '¥49,500',
  'tesou-ch5-sonota': '¥29,700',
  'tesou-ch6-ryunen': '¥49,500',
  'tesou-ch7-nayami': '¥39,600',
};

const plain = (p) => (p ? (p.rich_text || p.title || []).map((t) => t.plain_text).join('') : '');
const RICH = ['paragraph', 'bulleted_list_item', 'numbered_list_item', 'callout', 'quote', 'heading_1', 'heading_2', 'heading_3', 'toggle', 'to_do'];

let cur, rows = [];
do {
  const r = await api('/databases/' + DB + '/query', 'POST', { page_size: 100, start_cursor: cur });
  rows.push(...r.results);
  cur = r.has_more ? r.next_cursor : null;
} while (cur);

let changed = 0;
for (const row of rows) {
  if (row.properties['ステータス']?.select?.name !== '公開') continue;
  const slug = plain(row.properties['URLスラッグ']);
  const subs = SUBS.concat(CH39800[slug] ? [['受講料：¥39,800（標準価格・税込）', '受講料：' + CH39800[slug] + '（標準価格・税込）']] : []);
  const blocks = await api('/blocks/' + row.id + '/children?page_size=100');
  const hits = [];
  for (const b of blocks.results || []) {
    if (!RICH.includes(b.type)) continue;
    const rt = b[b.type].rich_text || [];
    const before = rt.map((t) => t.plain_text).join('');
    let after = before;
    for (const [a, z] of subs) after = after.split(a).join(z);
    if (after === before) continue;
    hits.push({ id: b.id, type: b.type, before, after, rt });
  }
  if (!hits.length) continue;
  console.log('\n■ ' + slug);
  for (const h of hits) {
    console.log('   [' + h.type + '] ' + h.before.slice(0, 80));
    console.log('        → ' + h.after.slice(0, 80));
    if (APPLY) {
      // 書式（太字・リンク等）は落とさず、先頭の1テキストに全文を入れ直す形にはせず、
      // 「1本の rich_text だけの単純なブロック」に限って置換する。複数に分かれている場合は
      // 各断片ごとに置換を試み、断片をまたぐ文字列は触らない。
      const next = h.rt.length === 1
        ? [{ ...h.rt[0], text: { ...h.rt[0].text, content: h.after }, plain_text: h.after }]
        : h.rt.map((t) => {
            let c = t.plain_text;
            for (const [a, z] of subs) c = c.split(a).join(z);
            return { ...t, text: { ...t.text, content: c }, plain_text: c };
          });
      const payload = next.map(({ type, text, annotations }) => ({ type: 'text', text: { content: text.content, link: text.link || null }, annotations }));
      await api('/blocks/' + h.id, 'PATCH', { [h.type]: { rich_text: payload } });
    }
    changed++;
  }
}

console.log('\n' + (APPLY ? '書き込みました' : 'ドライラン（書き込みなし）') + ': ' + changed + ' ブロック');
if (!APPLY) console.log('実際に反映するには --apply を付けて実行してください');
