// 講座名の変更（2026-10-17 本人決定）
//
//   旧：手相講座　◯◯編 / 手相個別フル講座
//   新：手相学大全　第N章 ◯◯編 / 手相学大全　個別フル講座
//
// 本人の選択は「(C) 章別まで冠する」。
//
//   node tools/kouza_rename_2026-10.mjs            ドライラン（何も書かない）
//   node tools/kouza_rename_2026-10.mjs --apply    実際に書き込む
//
// 対象は2つのDB。
//   マヨネリ講座DB … .env の NOTION_KOUZA_ID / NOTION_API_KEY
//   FL講座DB      … 下の FL_DB / .env の NOTION_FL_TOKEN
//     ※ FLは他の講師の講座も入っている共有DB。手相の行だけを触る。
//
// タイトルだけでなく **ページ本文のブロックも** 直す。
// /kouza/[slug] はNotionのページ本文を表示するので、本文に旧名が残ると画面に出る
// （過去に同じ事故があり kouza_body_update_2026-09.mjs で15ブロック直している）。
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const FL_DB = '9e653e0af59e47ebb3c1c9d443339e48';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);

const H = t => ({ Authorization: `Bearer ${t}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' });

// 旧タイトル → 新タイトル。ここに無いものは触らない。
const RENAME = new Map([
  ['手相講座　手相学編',                 '手相学大全　第1章 手相学編'],
  ['手相講座　手形・指編',               '手相学大全　第2章 手形・指編'],
  ['手相講座　丘編',                     '手相学大全　第3章 丘編'],
  ['手相講座　３大線編',                 '手相学大全　第4章 ３大線編'],
  ['手相講座　リソース・その他の線編',   '手相学大全　第5章 リソース・その他の線編'],
  ['手相講座　流年編',                   '手相学大全　第6章 流年編'],
  ['手相講座　悩みへのアプローチ方法',   '手相学大全　第7章 悩みへのアプローチ方法'],
  ['手相講座　全7章セット',             '手相学大全　全7章セット'],
  ['手相講座　流年アナログ、デジタル実践', '手相学大全　流年アナログ、デジタル実践'],
  ['手相講座　流年パック',               '手相学大全　流年パック'],
  ['手相個別フル講座',                   '手相学大全　個別フル講座'],
]);

// 本文の中の言い換え。長いものから順に当てる（部分一致の取り違えを防ぐ）
const BODY = [
  ['手相学習得プログラム 完全版', '手相学大全'],
  ['手相学習得プログラム',        '手相学大全'],
  ['手相講座　全7章セット',       '手相学大全　全7章セット'],
  ['手相講座 全7章セット',        '手相学大全　全7章セット'],
  ['手相個別フル講座',            '手相学大全　個別フル講座'],
];

async function api(path, tok, opt = {}) {
  const r = await fetch(`https://api.notion.com/v1/${path}`, { headers: H(tok), ...opt });
  const j = await r.json();
  if (j.object === 'error') throw new Error(`${j.code}: ${j.message?.slice(0, 120)}`);
  return j;
}

async function queryAll(db, tok) {
  let cursor, out = [];
  do {
    const j = await api(`databases/${db}/query`, tok,
      { method: 'POST', body: JSON.stringify(cursor ? { start_cursor: cursor } : {}) });
    out.push(...j.results);
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return out;
}

const titleOf = p => {
  const t = Object.values(p.properties).find(v => v.type === 'title');
  return { key: Object.entries(p.properties).find(([, v]) => v.type === 'title')[0],
           text: t?.title?.map(x => x.plain_text).join('') || '' };
};

const richText = b => (b[b.type]?.rich_text) || null;

async function blocksOf(id, tok, depth = 0) {
  if (depth > 2) return [];
  let cursor, out = [];
  do {
    const j = await api(`blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`, tok);
    for (const b of j.results) {
      out.push(b);
      if (b.has_children) out.push(...await blocksOf(b.id, tok, depth + 1));
    }
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);
  return out;
}

function rewrite(s) {
  let out = s;
  for (const [a, b] of BODY) out = out.split(a).join(b);
  return out;
}

// 書式（太字・リンク・色）を壊さないように、rich_text の run ごとに置換する。
// まるごと1つの run に潰すと、商品ページの強調やリンクが消えてしまう。
function rewriteRuns(rt) {
  let changed = false;
  const out = rt.map(r => {
    if (r.type !== 'text') return r;              // mention や equation はそのまま
    const after = rewrite(r.text.content);
    if (after === r.text.content) return r;
    changed = true;
    return { type: 'text',
             text: { content: after, link: r.text.link || null },
             annotations: r.annotations };
  });
  return { out, changed };
}

async function run(label, db, tok) {
  console.log(`\n================ ${label} ================`);
  const rows = await queryAll(db, tok);
  let nTitle = 0, nBlock = 0, nManual = 0;

  for (const p of rows) {
    const { key, text } = titleOf(p);
    const neo = RENAME.get(text);

    if (neo) {
      console.log(`  [タイトル] ${text}\n          → ${neo}`);
      nTitle++;
      if (APPLY) {
        await api(`pages/${p.id}`, tok, { method: 'PATCH', body: JSON.stringify({
          properties: { [key]: { title: [{ type: 'text', text: { content: neo } }] } } }) });
      }
    }

    // 手相の行だけ本文を見る（FLは共有DBなので他講師の行に触らない）
    const mine = neo || /手相/.test(text);
    if (!mine) continue;

    for (const b of await blocksOf(p.id, tok)) {
      const rt = richText(b);
      if (!rt || !rt.length) continue;
      const before = rt.map(x => x.plain_text).join('');
      const { out, changed } = rewriteRuns(rt);
      if (!changed) {
        // run をまたいで旧名が書かれていると、run 単位では置換できない。
        // 書式を壊したくないので自動では直さず、手で直す対象として報告する。
        if (before !== rewrite(before)) {
          console.log(`  [!! 手で直す] ${text}  runをまたいでいる: ${before.slice(0, 60)}`);
          nManual++;
        }
        continue;
      }
      const after = out.map(x => (x.type === 'text' ? x.text.content : (x.plain_text || ''))).join('');
      console.log(`  [本文] ${text}\n         - ${before.slice(0, 70)}\n         + ${after.slice(0, 70)}`);
      nBlock++;
      if (APPLY) {
        await api(`blocks/${b.id}`, tok, { method: 'PATCH', body: JSON.stringify({
          [b.type]: { rich_text: out } }) });
      }
    }
  }
  console.log(`  --- タイトル ${nTitle} 件 / 本文ブロック ${nBlock} 件` + (nManual ? ` / 手で直す ${nManual} 件` : "") + " ---");
  return { nTitle, nBlock, nManual };
}

const a = await run('マヨネリ講座DB', env.NOTION_KOUZA_ID, env.NOTION_API_KEY);
const b = await run('FL講座DB（共有。手相の行のみ）', FL_DB, env.NOTION_FL_TOKEN);

console.log(`\n==== 合計 タイトル ${a.nTitle + b.nTitle} 件 / 本文 ${a.nBlock + b.nBlock} 件` + ((a.nManual + b.nManual) ? ` / 手で直す ${a.nManual + b.nManual} 件` : "") + " ====");
console.log(APPLY ? '書き込みました。' : 'ドライランです。実行するには --apply を付けてください。');
