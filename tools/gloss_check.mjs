import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
(function () { try { const t = readFileSync(join(ROOT, '.env'), 'utf8'); for (const l of t.split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {} })();
const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB_ID = process.env.NOTION_GLOSSARY_ID || '344a43543ec2805e9409e969a3f3f651';
async function api(p, m, b) { const r = await fetch('https://api.notion.com/v1' + p, { method: m, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const j = await r.json(); if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(j)); return j; }
const rt = (p) => (p?.rich_text?.[0]?.plain_text) || '';
const pages = []; let c;
do { const body = { page_size: 100 }; if (c) body.start_cursor = c; const r = await api(`/databases/${DB_ID}/query`, 'POST', body); for (const p of r.results) pages.push({ name: p.properties['名前']?.title?.[0]?.plain_text || '', reading: rt(p.properties['読み']), cat: p.properties['カテゴリー']?.select?.name || '', status: p.properties['公開ステータス']?.status?.name || '' }); c = r.has_more ? r.next_cursor : null; } while (c);
const noReading = pages.filter((p) => !p.reading);
const noCat = pages.filter((p) => !p.cat);
console.log('総数:', pages.length);
console.log('読み無し:', noReading.length, '/ カテゴリー無し:', noCat.length);
console.log('公開ステータス内訳:', JSON.stringify(pages.reduce((a, p) => { a[p.status || '(空)'] = (a[p.status || '(空)'] || 0) + 1; return a; }, {})));
console.log('\n--- 読み無しの用語（五十音で拾えない）---');
console.log(noReading.map((p) => p.name).join(' / '));
