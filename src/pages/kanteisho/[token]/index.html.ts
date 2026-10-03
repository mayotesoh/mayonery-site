/**
 * 鑑定書ページ  /kanteisho/<token>/
 *
 * お客様個人の鑑定書。**中身は AES-256-GCM で暗号化されていて、合言葉を入れないと読めない。**
 * mayonery.jp は GitHub Pages なのでサーバー側の認証がかけられない。
 * そこで「配信するのは暗号文だけ、復号はブラウザの中でやる」という形にしてある。
 *
 * データの出どころ: 非公開リポジトリ mayotesoh/mayonery-kantei
 *   .kantei/payload/<token>.json  … 暗号文（氏名などの個人情報は入っていない）
 *   .kantei/shell.html            … 合言葉を聞いて復号する殻
 * ビルド時に deploy.yml が読み取り専用のデプロイキーで取ってくる（`.kantei/` は .gitignore 済み）。
 *
 * **殻のHTMLをここに書き写さないこと。** 正本は
 * `クロード広場/鑑定書/tools/encrypt.py` の SHELL で、shell.html はその書き出し。
 * 片方だけ直すと復号できなくなる。
 *
 * このページは sitemap から除外してある（astro.config.mjs の filter）。
 * **`/kantei/` は「手相鑑定」の公開ページで別物。** 鑑定書をそこに置くと、
 * sitemap の除外条件が公開ページまで巻き込む。
 * サイト内のどこからもリンクしないこと。
 */
import fs from 'node:fs';
import path from 'node:path';

const KANTEI_DIR = path.resolve(process.cwd(), '.kantei');
const PAYLOAD_DIR = path.join(KANTEI_DIR, 'payload');
const SHELL_PATH = path.join(KANTEI_DIR, 'shell.html');

type Payload = {
  token: string;
  見出し?: string;
  タイトル?: string;
  [k: string]: unknown;
};

/** 鑑定書が1件も無くてもビルドを通す（非公開リポジトリが取れない環境でも落とさない）。 */
export function getStaticPaths() {
  if (!fs.existsSync(PAYLOAD_DIR) || !fs.existsSync(SHELL_PATH)) {
    console.warn('[kantei] .kantei/ が見つかりません。鑑定書ページは作りません。');
    return [];
  }
  const files = fs.readdirSync(PAYLOAD_DIR).filter((f) => f.endsWith('.json'));
  const out: { params: { token: string }; props: { payload: Payload } }[] = [];
  for (const f of files) {
    try {
      const payload: Payload = JSON.parse(fs.readFileSync(path.join(PAYLOAD_DIR, f), 'utf-8'));
      // ファイル名と中の token がずれていたら、URLの取り違えになるので作らない
      const token = path.basename(f, '.json');
      if (!payload.token || payload.token !== token) {
        console.warn(`[kantei] token が一致しないので飛ばします: ${f}`);
        continue;
      }
      if (!/^[0-9a-f]{16,64}$/.test(token)) {
        console.warn(`[kantei] token の形が想定と違うので飛ばします: ${f}`);
        continue;
      }
      out.push({ params: { token }, props: { payload } });
    } catch (e) {
      console.warn(`[kantei] 読めませんでした: ${f} (${e})`);
    }
  }
  console.log(`[kantei] 鑑定書ページ ${out.length}件`);
  return out;
}

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function GET({ props }: { props: { payload: Payload } }) {
  const { payload } = props;
  const shell = fs.readFileSync(SHELL_PATH, 'utf-8');

  // 殻に渡すのは、暗号文と、合言葉画面の見出しだけ。**氏名は渡さない。**
  const { 見出し, タイトル, ...crypto } = payload;
  const html = shell
    .replace('__TITLE__', esc(タイトル ?? '手相鑑定書'))
    .replace('__NAME__', esc(見出し ?? '鑑定書をお届けします'))
    .replace('__PAYLOAD__', JSON.stringify(crypto));

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
