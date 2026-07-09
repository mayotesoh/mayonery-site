/**
 * 用語集を Notion に直接一括登録する（GAS不要）。Node 18+ / fetch使用。
 *
 * 使い方:
 *   1) リポジトリ直下の .env に Notion トークンを入れる:
 *        NOTION_API_KEY=ntn_xxx...            （Notionのインテグレーション トークン）
 *        NOTION_GLOSSARY_ID=344a43543ec2805e9409e969a3f3f651   （任意・既定あり）
 *   2) 用語集DBに、そのインテグレーションを「編集」権限で接続しておく
 *   3) node tools/notion_import.mjs
 *
 * 動作: 既存（同名）はスキップ、無いものだけ「公開ステータス=下書き」で新規作成。
 *      何度実行しても重複しない（idempotent）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ---- .env 読み込み（依存なし） ----
(function loadEnv() {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const txt = readFileSync(join(root, '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* .env が無ければ環境変数を使う */ }
})();

const TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_API_KEY2;
const DB_ID = process.env.NOTION_GLOSSARY_ID || '344a43543ec2805e9409e969a3f3f651';
if (!TOKEN) {
  console.error('NOTION_API_KEY が見つかりません（.env か環境変数に設定してください）');
  process.exit(1);
}

async function api(path, method, body) {
  const res = await fetch('https://api.notion.com/v1' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status + ' ' + JSON.stringify(json));
  return json;
}

const rt = (s) => {
  s = String(s || '');
  const out = [];
  for (let i = 0; i < s.length; i += 1900) out.push({ type: 'text', text: { content: s.slice(i, i + 1900) } });
  return out;
};

const blocks = (body) => {
  const b = [];
  (body || []).forEach((sec) => {
    if (sec.heading) {
      b.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: String(sec.heading).slice(0, 100) } }] } });
    }
    if (sec.text) {
      const s = String(sec.text);
      for (let i = 0; i < s.length; i += 1900) {
        b.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: s.slice(i, i + 1900) } }] } });
      }
    }
  });
  return b;
};

async function exists(name) {
  const r = await api(`/databases/${DB_ID}/query`, 'POST', { page_size: 1, filter: { property: '名前', title: { equals: name } } });
  return (r.results || []).length > 0;
}

async function createTerm(t) {
  const props = {
    名前: { title: [{ text: { content: String(t.name).slice(0, 100) } }] },
    公開ステータス: { status: { name: '下書き' } },
    SNSステータス: { status: { name: '未生成' } },
  };
  if (t.reading) props['読み'] = { rich_text: rt(t.reading) };
  if (t.category) props['カテゴリー'] = { select: { name: t.category } };
  if (t.slug) props['URLスラッグ'] = { rich_text: rt(t.slug) };
  if (t.meaning) props['意味'] = { rich_text: rt(t.meaning) };
  if (t.hillEnergy) props['丘のエネルギー'] = { rich_text: rt(t.hillEnergy) };
  await api('/pages', 'POST', { parent: { database_id: DB_ID }, properties: props, children: blocks(t.body).slice(0, 100) });
}

// data.mjs から用語データを読み込む
const { TERMS } = await import('./glossary_terms.mjs');

const main = async () => {
  let created = 0, skipped = 0, failed = 0;
  for (const t of TERMS) {
    try {
      if (await exists(t.name)) { skipped++; console.log('スキップ(既存): ' + t.name); continue; }
      await createTerm(t);
      created++;
      console.log('新規: ' + t.name);
    } catch (e) {
      failed++;
      console.error('失敗: ' + t.name + ' -> ' + (e.message || e));
    }
  }
  console.log(`\n=== 完了 === 新規${created} / スキップ${skipped} / 失敗${failed}`);
  console.log('※ サイト反映は git push か GitHub Actions の再ビルドで');
};

main();
