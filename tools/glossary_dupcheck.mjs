// 用語集の重複疑いを検出（読み取り専用）。 node tools/glossary_dupcheck.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
(function () { try { const t = readFileSync(join(ROOT, '.env'), 'utf8'); for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {} })();
const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB_ID = process.env.NOTION_GLOSSARY_ID || '344a43543ec2805e9409e969a3f3f651';
async function api(p, m, b) { const r = await fetch('https://api.notion.com/v1' + p, { method: m, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(r.status + JSON.stringify(j)); return j; }
const names = []; let c;
do { const body = { page_size: 100 }; if (c) body.start_cursor = c; const r = await api(`/databases/${DB_ID}/query`, 'POST', body); for (const p of r.results) names.push(p.properties['名前']?.title?.[0]?.plain_text || ''); c = r.has_more ? r.next_cursor : null; } while (c);
console.log('用語総数:', names.length);
// 正規化: スペース・「/ 別名」を除去した先頭語で束ねる
const norm = (n) => n.replace(/\s*[／/].*$/, '').replace(/\s+/g, '').trim();
const groups = {};
for (const n of names) { const k = norm(n); (groups[k] = groups[k] || []).push(n); }
const dups = Object.entries(groups).filter(([, v]) => v.length > 1);
console.log('重複疑いグループ:', dups.length);
for (const [k, v] of dups) console.log('  ' + k + '  <=  [' + v.join(' | ') + ']');
