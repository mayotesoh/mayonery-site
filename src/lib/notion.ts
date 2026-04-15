import { Client } from "@notionhq/client";

// .envに隠した鍵を使って、Notionへの接続を準備する
export const notion = new Client({
  auth: import.meta.env.NOTION_API_KEY,
});

// データベースの住所もすぐ使えるようにしておく
export const databaseId = import.meta.env.NOTION_DATABASE_ID;