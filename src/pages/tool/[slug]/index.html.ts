/**
 * 合言葉つきのツール  /tool/<slug>/
 *
 * 講座の受講生向けのツール（いまは手相流年ツール）。**中身は AES-256-GCM で暗号化されていて、
 * 合言葉を入れないと読めない。** ツールには講座限定の中身が入っているので、
 * このリポジトリ（PUBLIC）にも配信するページにも平文を置かない。
 *
 * データの出どころ: 非公開リポジトリ mayotesoh/mayonery-kantei（鑑定書と同じ。deploy.yml が .kantei/ に取得）
 *   .kantei/ryunen/payload.json … { slug, iter, salt, iv, ct }（暗号文とURLの slug だけ）
 *   .kantei/ryunen/shell.html   … 合言葉を聞いて復号する殻
 * **URLの slug も非公開リポジトリ側にある**ので、このファイルを読んでもURLは分からない。
 *
 * **殻のHTMLをここに書き写さないこと。** 正本は
 * `クロード広場/手相流年ツール/tools/publish_web.py` の SHELL。
 *
 * sitemap から除外してある（astro.config.mjs の filter。パスが /tool/ で始まるものだけ）。
 * サイト内のどこからもリンクしないこと。
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), '.kantei', 'ryunen');
const PAYLOAD = path.join(DIR, 'payload.json');
const SHELL = path.join(DIR, 'shell.html');

type Payload = { slug: string; iter: number; salt: string; iv: string; ct: string; [k: string]: unknown };

/** 非公開リポジトリが取れない環境でもビルドを落とさない。 */
export function getStaticPaths() {
  if (!fs.existsSync(PAYLOAD) || !fs.existsSync(SHELL)) {
    console.warn('[tool] .kantei/ryunen/ が見つかりません。ツールのページは作りません。');
    return [];
  }
  try {
    const payload: Payload = JSON.parse(fs.readFileSync(PAYLOAD, 'utf-8'));
    if (!/^[0-9a-f]{16,64}$/.test(payload.slug || '')) {
      console.warn('[tool] slug の形が想定と違うので作りません');
      return [];
    }
    console.log('[tool] 流年ツール 1件');
    return [{ params: { slug: payload.slug }, props: { payload } }];
  } catch (e) {
    console.warn(`[tool] 読めませんでした (${e})`);
    return [];
  }
}

export function GET({ props }: { props: { payload: Payload } }) {
  const { slug, ...crypto } = props.payload;   // 殻に渡すのは暗号文だけ
  const html = fs.readFileSync(SHELL, 'utf-8').replace('__PAYLOAD__', JSON.stringify(crypto));
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
