// FortuneLabo の講座DB → マヨネリの講座DB へ取り込み。
//   node tools/fl_kouza_import.mjs           … 差分を表示するだけ（書き込みなし）
//   node tools/fl_kouza_import.mjs --apply   … 実際に作成／更新する
//
// 対象は「担当講師＝手相のマヨネリ」かつ手相の講座のみ（COURSES に明示）。
// 価格は FL の「非会員価格」＝標準価格をそのまま載せる（会員価格は載せない）。
// FL側は別ワークスペースのため、読み取りには .env の NOTION_FL_TOKEN を使う。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

(function loadEnv() {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const txt = readFileSync(join(root, '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
})();

const APPLY = process.argv.includes('--apply');
const FL_TOKEN = process.env.NOTION_FL_TOKEN;
const MY_TOKEN = process.env.NOTION_API_KEY;
const MY_DB = process.env.NOTION_KOUZA_ID;
const FL_COURSE_DB = '9e653e0af59e47ebb3c1c9d443339e48';

if (!FL_TOKEN) throw new Error('.env に NOTION_FL_TOKEN がありません');
if (!MY_TOKEN || !MY_DB) throw new Error('.env に NOTION_API_KEY / NOTION_KOUZA_ID がありません');

async function api(token, path, method, body) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j));
  return j;
}

async function queryAll(token, db, body = {}) {
  let cursor, out = [];
  do {
    const q = await api(token, `/databases/${db}/query`, 'POST', { ...body, page_size: 100, start_cursor: cursor });
    out.push(...q.results);
    cursor = q.has_more ? q.next_cursor : undefined;
  } while (cursor);
  return out;
}

const txt = (p) => (p?.title ?? p?.rich_text ?? []).map((t) => t.plain_text).join('');
const yen = (n) => `¥${Number(n).toLocaleString('ja-JP')}`;

// 取り込む講座と、サイト側のスラッグ・レベル。FL の講座名で突き合わせる。
// 並び順＝サイトの一覧に出したい順（Notionは作成順に並ぶため、この順で作る）。
const COURSES = [
  { fl: '手相講座　手相学編',                 slug: 'tesou-ch1-gairon',      levels: ['基礎'] },
  { fl: '手相講座　手形・指編',               slug: 'tesou-ch2-tegata-yubi', levels: ['基礎'] },
  { fl: '手相講座　丘編',                     slug: 'tesou-ch3-oka',         levels: ['基礎'] },
  { fl: '手相講座　３大線編',                 slug: 'tesou-ch4-sandaisen',   levels: ['基礎', '応用'] },
  { fl: '手相講座　リソース・その他の線編',   slug: 'tesou-ch5-sonota',      levels: ['応用'] },
  { fl: '手相講座　流年編',                   slug: 'tesou-ch6-ryunen',      levels: ['応用'] },
  { fl: '手相講座　悩みへのアプローチ方法',   slug: 'tesou-ch7-nayami',      levels: ['応用'] },
  { fl: '手相講座　全7章セット',              slug: 'tesou-set-all7',        levels: ['基礎', '応用'] },
  { fl: '手相講座　流年アナログ、デジタル実践', slug: 'tesou-ryunen-jissen', levels: ['応用'] },
  { fl: '手相個別フル講座',                   slug: 'tesou-kobetsu-full',    levels: ['基礎', '応用'] },
];

// 「非公開」に下げる既存の講座（FL側の講座と内容・価格が重複するため）
const RETIRE_SLUGS = ['mastery-program-group', 'mastery-program-individual'];

const rt = (content) => [{ type: 'text', text: { content } }];

function buildBlocks(c) {
  const blocks = [];
  if (c.desc) {
    for (const para of c.desc.split(/\n{2,}/)) {
      if (para.trim()) blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt(para.trim()) } });
    }
  }
  const items = [];
  if (c.period) items.push(`期間・時間：${c.period}`);
  if (c.method) items.push(`提供方法：${c.method}`);
  items.push(`受講料：${yen(c.price)}（標準価格・税込）`);
  blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: rt('講座の形式') } });
  for (const it of items) {
    blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(it) } });
  }
  if (c.extra) {
    blocks.push({ object: 'block', type: 'callout', callout: { icon: { emoji: '📌' }, rich_text: rt(c.extra) } });
  }
  return blocks;
}

// ---- FL側を読む ----
const flRows = await queryAll(FL_TOKEN, FL_COURSE_DB);
const flByName = new Map(flRows.map((r) => [txt(r.properties['講座名']), r]));

const planned = [];
for (const spec of COURSES) {
  const row = flByName.get(spec.fl);
  if (!row) { console.log(`⚠ FLに見つかりません: ${spec.fl}`); continue; }
  const p = row.properties;
  const price = p['非会員価格']?.number;
  if (!price) { console.log(`⚠ 非会員価格が未設定のためスキップ: ${spec.fl}`); continue; }
  planned.push({
    ...spec,
    title: spec.fl,
    desc: txt(p['説明']),
    period: txt(p['期間・時間']),
    method: txt(p['提供方法']),
    extra: txt(p['補足']),
    price,
  });
}

// ---- マヨネリ側の既存行 ----
const myRows = await queryAll(MY_TOKEN, MY_DB);
const bySlug = new Map(myRows.map((r) => [txt(r.properties['URLスラッグ']), r]));

console.log(`\n=== 取り込み対象 ${planned.length}件 ===`);
for (const c of planned) {
  const exists = bySlug.has(c.slug);
  console.log(`${exists ? '更新' : '新規'}  ${c.title}  ${yen(c.price)}  /kouza/${c.slug}`);
}
console.log(`\n=== 非公開に下げる ===`);
for (const slug of RETIRE_SLUGS) {
  const r = bySlug.get(slug);
  console.log(r ? `  ${txt(r.properties['タイトル'])} (${slug})` : `  (見つかりません: ${slug})`);
}

if (!APPLY) {
  console.log('\n※ 確認のみ。実行するには --apply を付けてください。');
  process.exit(0);
}

// ---- 書き込み ----
for (const c of planned) {
  const props = {
    'タイトル': { title: rt(c.title) },
    '概要': { rich_text: rt(c.desc.replace(/\n+/g, ' ').slice(0, 1900)) },
    '価格': { rich_text: rt(yen(c.price)) },
    'URLスラッグ': { rich_text: rt(c.slug) },
    'レベル': { multi_select: c.levels.map((name) => ({ name })) },
    'ステータス': { select: { name: '公開' } },
  };
  const existing = bySlug.get(c.slug);
  if (existing) {
    await api(MY_TOKEN, '/pages/' + existing.id, 'PATCH', { properties: props });
    // 本文は作り直す（既存ブロックを削除してから追加）
    const kids = await api(MY_TOKEN, `/blocks/${existing.id}/children?page_size=100`, 'GET');
    for (const b of kids.results) await api(MY_TOKEN, '/blocks/' + b.id, 'DELETE');
    await api(MY_TOKEN, `/blocks/${existing.id}/children`, 'PATCH', { children: buildBlocks(c) });
    console.log('更新:', c.title);
  } else {
    await api(MY_TOKEN, '/pages', 'POST', {
      parent: { database_id: MY_DB },
      properties: props,
      children: buildBlocks(c),
    });
    console.log('作成:', c.title);
  }
}

for (const slug of RETIRE_SLUGS) {
  const r = bySlug.get(slug);
  if (!r) continue;
  await api(MY_TOKEN, '/pages/' + r.id, 'PATCH', { properties: { 'ステータス': { select: { name: '非公開' } } } });
  console.log('非公開:', txt(r.properties['タイトル']));
}

console.log('\n完了');
