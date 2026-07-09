/**
 * クイズDBへ一括登録（GAS不要）。
 *   - tools/quiz_table.md（提供いただいた問題表）を解析
 *   - tools/quiz_generated.mjs（Claude生成の新規問題）を追加
 *   - 既存と同じ問題文はスキップ（重複防止）
 * 実行: node tools/quiz_import.mjs
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
const DB_ID = process.env.NOTION_QUIZ_ID || '347a43543ec2805f82f2cbb58642599e';
if (!TOKEN) { console.error('NOTION_API_KEY(2) が .env にありません'); process.exit(1); }

async function api(path, method, body) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j));
  return j;
}
const one = (s) => (s ? [{ type: 'text', text: { content: String(s).slice(0, 1900) } }] : []);

// --- quiz_table.md をパース ---
function parseTable() {
  const md = readFileSync(join(ROOT, 'tools', 'quiz_table.md'), 'utf8');
  const rows = [];
  const lines = md.split(/\r?\n/).filter((l) => l.trim().startsWith('|'));
  for (let i = 2; i < lines.length; i++) { // 0:ヘッダ 1:区切り
    const cells = lines[i].split('|').map((c) => c.trim());
    // 先頭/末尾の空セルを除去
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    if (cells.length < 7) continue;
    rows.push({ q: cells[0], opts: [cells[1], cells[2], cells[3], cells[4]], ans: cells[5], exp: cells[6] });
  }
  return rows;
}

const { GENERATED } = await import('./quiz_generated.mjs');

async function existsQ(q) {
  const r = await api(`/databases/${DB_ID}/query`, 'POST', { page_size: 1, filter: { property: '問題文', title: { equals: q } } });
  return (r.results || []).length > 0;
}

async function createQuiz(item) {
  const props = {
    問題文: { title: [{ text: { content: String(item.q).slice(0, 200) } }] },
    選択肢1: { rich_text: one(item.opts[0]) },
    選択肢2: { rich_text: one(item.opts[1]) },
    選択肢3: { rich_text: one(item.opts[2]) },
    選択肢4: { rich_text: one(item.opts[3]) },
    正解の番号: { rich_text: one(String(item.ans)) },
    解説: { rich_text: one(item.exp) },
  };
  await api('/pages', 'POST', { parent: { database_id: DB_ID }, properties: props });
}

const all = [...parseTable(), ...GENERATED];
console.log(`表:${parseTable().length}件 + 生成:${GENERATED.length}件 = 合計${all.length}件を処理`);

let created = 0, skipped = 0, failed = 0;
const seen = new Set();
for (const item of all) {
  try {
    if (!item.q || seen.has(item.q)) { skipped++; continue; }
    seen.add(item.q);
    if (await existsQ(item.q)) { skipped++; console.log('スキップ(既存): ' + item.q.slice(0, 24) + '…'); continue; }
    await createQuiz(item);
    created++;
    console.log('新規: ' + item.q.slice(0, 24) + '…');
  } catch (e) {
    failed++;
    console.error('失敗: ' + String(item.q).slice(0, 20) + ' -> ' + (e.message || e));
  }
}
console.log(`\n=== 完了 === 新規${created} / スキップ${skipped} / 失敗${failed}`);
