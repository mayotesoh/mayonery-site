// DBのスキーマ確認用（読み取り専用）。 node tools/notion_inspect.mjs <DB_ID>
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

const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB_ID = process.argv[2] || '347a43543ec2805f82f2cbb58642599e'; // 既定=クイズDB

async function api(path, method, body) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j));
  return j;
}

const db = await api('/databases/' + DB_ID, 'GET');
console.log('=== プロパティ一覧 ===');
for (const [name, def] of Object.entries(db.properties)) {
  let extra = '';
  if (def.type === 'select' && def.select?.options) extra = ' [' + def.select.options.map(o => o.name).join(', ') + ']';
  if (def.type === 'status' && def.status?.options) extra = ' [' + def.status.options.map(o => o.name).join(', ') + ']';
  console.log(`  ${name} : ${def.type}${extra}`);
}

const q = await api('/databases/' + DB_ID + '/query', 'POST', { page_size: 1 });
console.log('\n=== 既存1件のサンプル ===');
console.log('件数(先頭1件):', (q.results || []).length);
if (q.results?.[0]) {
  for (const [name, val] of Object.entries(q.results[0].properties)) {
    let out = '';
    if (val.type === 'title') out = (val.title[0]?.plain_text) || '';
    else if (val.type === 'rich_text') out = (val.rich_text[0]?.plain_text) || '';
    else if (val.type === 'select') out = val.select?.name || '';
    else if (val.type === 'number') out = val.number;
    else out = JSON.stringify(val[val.type]);
    console.log(`  ${name} (${val.type}): ${out}`);
  }
}
