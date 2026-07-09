#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
講座録画 → 文字起こし → 要約（有料コンテンツ素材化）ローカル実行スクリプト

このスクリプトは「GASの外」で動かす重い処理（ffmpeg + Whisper）を担当します。
出力（書き起こし .txt / 要約 .md）は、Google ドライブ同期フォルダに保存すれば
そのまま素材として使えます。無料ブログには自動流入しません（有料側で扱う想定）。

--------------------------------------------------------------------
【準備（1回だけ）】
  1) ffmpeg をインストール（Windows: https://www.gyan.dev/ffmpeg/builds/ を PATH に）
  2) pip install -r tools/requirements.txt
  3) （要約を使う場合）環境変数 GEMINI_API_KEY を設定（無料。Claudeなら ANTHROPIC_API_KEY）

【使い方】
  # ローカルの動画/音声（mp4, mov, m4a, mp3 いずれもOK）
  python tools/transcribe.py "C:/videos/kouza01.mp4"

  # YouTube（限定公開URLも可）
  python tools/transcribe.py "https://youtu.be/xxxxxxxx"

  # フォルダ内の動画をまとめて
  python tools/transcribe.py "C:/videos"

  # 出力先やモデルを指定
  python tools/transcribe.py "C:/videos/kouza01.mp4" --out "G:/マイドライブ/手相書き起こし" --model medium
--------------------------------------------------------------------
"""

import os
import sys
import argparse
import glob

# ===== 既定設定（環境変数で上書き可）=====
DEFAULT_OUT = os.environ.get("TRANSCRIBE_OUT", os.path.join(os.getcwd(), "transcripts"))
DEFAULT_MODEL = os.environ.get("WHISPER_MODEL", "medium")   # tiny/base/small/medium/large-v3
LANGUAGE = os.environ.get("WHISPER_LANG", "ja")
# 要約LLM（既定Gemini無料。GEMINI_API_KEY が無ければ ANTHROPIC を試す）
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

VIDEO_AUDIO_EXT = (".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4a", ".mp3", ".wav", ".aac", ".flac")


def is_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def fetch_youtube_audio(url: str, workdir: str) -> str:
    """YouTube から音声を取得して m4a パスを返す。"""
    from yt_dlp import YoutubeDL

    os.makedirs(workdir, exist_ok=True)
    outtmpl = os.path.join(workdir, "%(id)s.%(ext)s")
    opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "m4a"}
        ],
        "quiet": True,
        "no_warnings": True,
    }
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
    audio_path = os.path.join(workdir, info["id"] + ".m4a")
    title = info.get("title", info["id"])
    return audio_path, title


def transcribe_audio(path: str, model_size: str) -> str:
    """faster-whisper で文字起こしして全文テキストを返す。"""
    from faster_whisper import WhisperModel

    print(f"  [whisper] モデル読込: {model_size}（初回はDLに時間がかかります）")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    print(f"  [whisper] 文字起こし中: {os.path.basename(path)}")
    segments, info = model.transcribe(path, language=LANGUAGE, vad_filter=True)

    parts = []
    for seg in segments:
        parts.append(seg.text.strip())
    return "\n".join(p for p in parts if p)


def summarize(text: str, title: str) -> str:
    """要約＋記事化のたたき台を作る（任意）。既定はGemini無料、無ければClaude。"""
    system = (
        "あなたは『ロジカル手相学』の編集者です。オカルトや断定的な運命論を排し、"
        "論理的で読みやすい教材素材に整えます。"
    )
    user = (
        f"次の講座の書き起こしを、有料教材の素材として整理してください。\n"
        f"タイトル: {title}\n\n"
        "出力（Markdown）:\n"
        "1. 3行サマリー\n2. 章立て（見出し案）\n3. 重要ポイント箇条書き\n"
        "4. そのまま使える教材本文（見出し付き・整文済み）\n\n"
        "=== 書き起こしここから ===\n" + text[:60000] + "\n=== ここまで ==="
    )

    if GEMINI_API_KEY:
        return _summarize_gemini(system, user)
    if ANTHROPIC_API_KEY:
        return _summarize_claude(system, user)
    return ""  # どちらのキーも無ければ要約はスキップ


def _summarize_gemini(system: str, user: str) -> str:
    import json
    import urllib.request

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY
    )
    payload = json.dumps({
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 4096},
    }).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload, headers={"content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            data = json.loads(res.read().decode("utf-8"))
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"  [warn] 要約(Gemini)に失敗: {e}")
        return ""


def _summarize_claude(system: str, user: str) -> str:
    import json
    import urllib.request

    payload = json.dumps({
        "model": CLAUDE_MODEL,
        "max_tokens": 4000,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            data = json.loads(res.read().decode("utf-8"))
        return data["content"][0]["text"]
    except Exception as e:
        print(f"  [warn] 要約(Claude)に失敗: {e}")
        return ""


def process_one(target: str, out_dir: str, model_size: str, workdir: str):
    if is_url(target):
        audio_path, title = fetch_youtube_audio(target, workdir)
    else:
        audio_path = target
        title = os.path.splitext(os.path.basename(target))[0]

    text = transcribe_audio(audio_path, model_size)
    if not text.strip():
        print(f"  [skip] 文字起こし結果が空: {title}")
        return

    os.makedirs(out_dir, exist_ok=True)
    safe = "".join(c for c in title if c not in '\\/:*?"<>|').strip()[:80] or "transcript"

    txt_path = os.path.join(out_dir, safe + ".txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"  [saved] {txt_path}")

    summary = summarize(text, title)
    if summary:
        md_path = os.path.join(out_dir, safe + ".summary.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(summary)
        print(f"  [saved] {md_path}")


def expand_targets(inputs):
    targets = []
    for item in inputs:
        if is_url(item):
            targets.append(item)
        elif os.path.isdir(item):
            for ext in VIDEO_AUDIO_EXT:
                targets.extend(glob.glob(os.path.join(item, "*" + ext)))
        elif os.path.isfile(item):
            targets.append(item)
        else:
            print(f"  [warn] 見つかりません: {item}")
    return targets


def main():
    parser = argparse.ArgumentParser(description="講座録画の文字起こし＆要約")
    parser.add_argument("inputs", nargs="+", help="動画/音声ファイル、フォルダ、またはYouTube URL")
    parser.add_argument("--out", default=DEFAULT_OUT, help="出力フォルダ（Drive同期先など）")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Whisperモデル（既定: medium）")
    args = parser.parse_args()

    workdir = os.path.join(args.out, "_work")
    targets = expand_targets(args.inputs)
    if not targets:
        print("処理対象がありません。")
        sys.exit(1)

    print(f"対象 {len(targets)} 件 / 出力先: {args.out}")
    for i, t in enumerate(targets, 1):
        print(f"[{i}/{len(targets)}] {t}")
        try:
            process_one(t, args.out, args.model, workdir)
        except Exception as e:
            print(f"  [error] {e}")

    print("完了。書き起こし .txt と .summary.md を確認してください。")


if __name__ == "__main__":
    main()
