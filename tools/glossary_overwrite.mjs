/**
 * B: 以前GASのテストで入った薄い版の用語を、整えた版で上書きする。
 * 実行: node tools/glossary_overwrite.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
(function loadEnv() {
  try {
    const txt = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
})();
const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB_ID = process.env.NOTION_GLOSSARY_ID || '344a43543ec2805e9409e969a3f3f651';

async function api(path, method, body) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j));
  return j;
}
const rt = (s) => { s = String(s || ''); const o = []; for (let i = 0; i < s.length; i += 1900) o.push({ type: 'text', text: { content: s.slice(i, i + 1900) } }); return o; };
const blocks = (body) => {
  const b = [];
  (body || []).forEach((sec) => {
    if (sec.heading) b.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: String(sec.heading).slice(0, 100) } }] } });
    if (sec.text) { const s = String(sec.text); for (let i = 0; i < s.length; i += 1900) b.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: s.slice(i, i + 1900) } }] } }); }
  });
  return b;
};
async function findPage(name) {
  const r = await api(`/databases/${DB_ID}/query`, 'POST', { page_size: 1, filter: { property: '名前', title: { equals: name } } });
  return r.results?.[0] || null;
}
async function deleteChildren(id) {
  const r = await api(`/blocks/${id}/children?page_size=100`, 'GET');
  for (const b of (r.results || [])) await api('/blocks/' + b.id, 'DELETE');
}

const { TERMS } = await import('./glossary_terms.mjs');
const NAMES = ['合同丘', '切り替わり', '細かい線', '二重生命線', '水の手', '風の手'];

let done = 0, miss = 0;
for (const name of NAMES) {
  const t = TERMS.find((x) => x.name === name);
  if (!t) { console.log('データ無し: ' + name); continue; }
  const page = await findPage(name);
  if (!page) { miss++; console.log('ページ無し(スキップ): ' + name); continue; }
  const props = {
    意味: { rich_text: rt(t.meaning || '') },
    丘のエネルギー: { rich_text: rt(t.hillEnergy || '') },
    読み: { rich_text: rt(t.reading || '') },
    カテゴリー: { select: { name: t.category } },
    URLスラッグ: { rich_text: rt(t.slug || '') },
  };
  await api('/pages/' + page.id, 'PATCH', { properties: props });
  await deleteChildren(page.id);
  const bl = blocks(t.body);
  if (bl.length) await api(`/blocks/${page.id}/children`, 'PATCH', { children: bl });
  done++;
  console.log('上書き: ' + name);
}
console.log(`\n=== 完了 === 上書き${done} / ページ無し${miss}`);
