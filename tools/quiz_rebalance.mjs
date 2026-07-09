/**
 * クイズの正解番号を1〜4に均等分散させる。
 * 選択肢の中身・解説は変えず、並び順だけ入れ替えて 正解の番号 を更新。
 * 実行: node tools/quiz_rebalance.mjs
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

async function api(path, method, body) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method, headers: { Authorization: 'Bearer ' + TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(j));
  return j;
}
const txt = (p) => (p?.rich_text?.[0]?.plain_text) || '';
const one = (s) => (s ? [{ type: 'text', text: { content: String(s).slice(0, 1900) } }] : []);

// 全クイズ取得
const quizzes = [];
let cursor;
do {
  const body = { page_size: 100 };
  if (cursor) body.start_cursor = cursor;
  const r = await api(`/databases/${DB_ID}/query`, 'POST', body);
  for (const p of r.results) {
    const opts = [txt(p.properties['選択肢1']), txt(p.properties['選択肢2']), txt(p.properties['選択肢3']), txt(p.properties['選択肢4'])];
    const ans = parseInt(txt(p.properties['正解の番号']), 10);
    quizzes.push({ id: p.id, opts, ans });
  }
  cursor = r.has_more ? r.next_cursor : null;
} while (cursor);

const dist = (arr) => arr.reduce((a, q) => { a[q.ans] = (a[q.ans] || 0) + 1; return a; }, {});
console.log('総数:', quizzes.length);
console.log('調整前分布:', JSON.stringify(dist(quizzes)));

// 貪欲に最小カウントへ割り当て（1〜4を均等化）
const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
let changed = 0, failed = 0;
for (const q of quizzes) {
  if (!(q.ans >= 1 && q.ans <= 4)) { continue; }
  // 目標位置＝現在カウント最小（同数は小さい番号）
  let target = 1;
  for (const k of [2, 3, 4]) if (counts[k] < counts[target]) target = k;
  counts[target]++;

  if (target === q.ans) continue; // 既に目標位置

  const correct = q.opts[q.ans - 1];
  const others = q.opts.filter((_, i) => i !== q.ans - 1);
  const res = [null, null, null, null];
  res[target - 1] = correct;
  let oi = 0;
  for (let i = 0; i < 4; i++) if (res[i] === null) res[i] = others[oi++];

  try {
    await api('/pages/' + q.id, 'PATCH', {
      properties: {
        選択肢1: { rich_text: one(res[0]) },
        選択肢2: { rich_text: one(res[1]) },
        選択肢3: { rich_text: one(res[2]) },
        選択肢4: { rich_text: one(res[3]) },
        正解の番号: { rich_text: one(String(target)) },
      },
    });
    changed++;
  } catch (e) { failed++; console.error('失敗:', e.message || e); }
}
console.log('調整後の目標分布:', JSON.stringify(counts));
console.log(`=== 完了 === 変更${changed} / 失敗${failed}`);
