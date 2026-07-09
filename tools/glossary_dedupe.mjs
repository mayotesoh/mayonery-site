/**
 * 用語集の重複解消：正規化キーで束ね、本文が濃い方を残し薄い方をアーカイブ。
 * 別名付きタイトル（例「頭脳線 / 知能線」）があれば、残す側のタイトルをそれに統一。
 * 実行: node tools/glossary_dedupe.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
(function () { try { const t = readFileSync(join(ROOT, '.env'), 'utf8'); for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {} })();
const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB_ID = process.env.NOTION_GLOSSARY_ID || '344a43543ec2805e9409e969a3f3f651';
async function api(p, m, b) { const r = await fetch('https://api.notion.com/v1' + p, { method: m, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(j)); return j; }
const blockText = (b) => { const rt = b[b.type]?.rich_text; return Array.isArray(rt) ? rt.map((t) => t.plain_text).join('') : ''; };

// 全ページ
const pages = []; let c;
do { const body = { page_size: 100 }; if (c) body.start_cursor = c; const r = await api(`/databases/${DB_ID}/query`, 'POST', body); for (const p of r.results) pages.push({ id: p.id, title: p.properties['名前']?.title?.[0]?.plain_text || '', meaning: (p.properties['意味']?.rich_text || []).map((t) => t.plain_text).join('') }); c = r.has_more ? r.next_cursor : null; } while (c);

const norm = (n) => n.replace(/\s*[／/].*$/, '').replace(/\s+/g, '').trim();
const groups = {};
for (const p of pages) (groups[norm(p.title)] = groups[norm(p.title)] || []).push(p);

async function score(p) {
  const r = await api(`/blocks/${p.id}/children?page_size=100`, 'GET');
  const bodyLen = (r.results || []).map(blockText).join('').length;
  return p.meaning.length + bodyLen;
}

let archived = 0, renamed = 0;
for (const [key, arr] of Object.entries(groups)) {
  if (arr.length < 2) continue;
  for (const p of arr) p.score = await score(p);
  // 残す＝スコア最大（同点は別名付きタイトルを優先）
  arr.sort((a, b) => b.score - a.score || (/[／/]/.test(b.title) ? 1 : 0) - (/[／/]/.test(a.title) ? 1 : 0));
  const keep = arr[0];
  const aliased = arr.find((p) => /[／/]/.test(p.title));
  const bestTitle = aliased ? aliased.title : keep.title;

  console.log(`【${key}】残す: "${keep.title}"(${keep.score}) / 消す: ${arr.slice(1).map((p) => `"${p.title}"(${p.score})`).join(', ')}`);

  // タイトル統一
  if (keep.title !== bestTitle) {
    await api('/pages/' + keep.id, 'PATCH', { properties: { 名前: { title: [{ text: { content: bestTitle } }] } } });
    renamed++;
    console.log(`   → タイトルを "${bestTitle}" に統一`);
  }
  // それ以外をアーカイブ
  for (const p of arr.slice(1)) {
    await api('/pages/' + p.id, 'PATCH', { archived: true });
    archived++;
  }
}
console.log(`\n=== 完了 === アーカイブ${archived} / 改名${renamed}`);
