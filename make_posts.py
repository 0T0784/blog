"""posts/ の記事(.md)を読んで、記事一覧 posts.json を作る。記事を足したら実行するだけ。
  python make_posts.py
ファイル名: 2026-11-12-好きな名前.md （先頭の日付が記事の日付になる）
"""
import json, re, pathlib

root = pathlib.Path(__file__).parent
# ファイル名にこの言葉が入っている記事は、一覧には出さず「検索したときだけ」表示する（大文字小文字は区別しない）
HIDDEN_WORDS = ["test", "private"]
posts = []
for f in sorted((root / "posts").glob("*.md")):
    m = re.match(r"(\d{4}-\d{2}-\d{2})-", f.stem)
    if not m:
        print(f"スキップ: {f.name}（ファイル名を 2026-11-12-名前.md の形にしてね）")
        continue
    text = f.read_text(encoding="utf-8-sig")   # Windowsのメモ帳が付けるBOMも許容
    title, excerpt, thumb = "", "", ""
    for line in text.splitlines():
        l = line.strip()
        if not l:
            continue
        t = re.match(r"#(?!#)\s*(\S.*)", l)          # 「# 題名」「#題名」どちらもOK（## は見出し扱い）
        if t and not title:
            title = t.group(1).strip()
            continue
        img = re.match(r"!\[.*?\]\((.+?)\)$", l)
        yt = re.search(r"(?:[?&]v=|youtu\.be/|embed/|shorts/|live/)([\w-]{11})", l) if re.match(r"https?://\S+$", l) else None
        if img and not thumb:
            thumb = img.group(1)
        elif yt and not thumb:
            thumb = f"https://i.ytimg.com/vi/{yt.group(1)}/hqdefault.jpg"
        elif not excerpt and not img and not yt and not re.match(r"(#|[-*>] |https?://)", l):
            excerpt = re.sub(r"[*\[\]]|\(https?:[^)]*\)", "", l)[:80]
    title = title or f.stem[len(m.group(0)):] or f.stem   # 題名が無いときはファイル名の日付より後ろを使う
    posts.append({"slug": f.stem, "title": title, "date": m.group(1), "excerpt": excerpt, "thumb": thumb,
                  "hidden": any(w in f.stem.lower() for w in HIDDEN_WORDS)})

posts.sort(key=lambda p: p["slug"], reverse=True)   # 新しい順
(root / "posts.json").write_text(json.dumps({"posts": posts}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(posts)}件の記事で posts.json を作りました")
