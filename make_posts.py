"""posts/ の記事(.md)を読んで、記事一覧 posts.json を作る。記事を足したら実行するだけ。
  python make_posts.py
ファイル名: 2026-11-12-好きな名前.md （先頭の日付が記事の日付になる）
"""
import json, re, pathlib

root = pathlib.Path(__file__).parent
posts = []
for f in sorted((root / "posts").glob("*.md")):
    m = re.match(r"(\d{4}-\d{2}-\d{2})-", f.stem)
    if not m:
        print(f"スキップ: {f.name}（ファイル名を 2026-11-12-名前.md の形にしてね）")
        continue
    text = f.read_text(encoding="utf-8")
    title, excerpt, thumb = f.stem, "", ""
    for line in text.splitlines():
        l = line.strip()
        if not l:
            continue
        if l.startswith("# ") and title == f.stem:
            title = l[2:].strip()
            continue
        img = re.match(r"!\[.*?\]\((.+?)\)$", l)
        yt = re.search(r"(?:[?&]v=|youtu\.be/|embed/|shorts/|live/)([\w-]{11})", l) if re.match(r"https?://\S+$", l) else None
        if img and not thumb:
            thumb = img.group(1)
        elif yt and not thumb:
            thumb = f"https://i.ytimg.com/vi/{yt.group(1)}/hqdefault.jpg"
        elif not excerpt and not img and not yt and not re.match(r"(#|[-*>] |https?://)", l):
            excerpt = re.sub(r"[*\[\]]|\(https?:[^)]*\)", "", l)[:80]
    posts.append({"slug": f.stem, "title": title, "date": m.group(1), "excerpt": excerpt, "thumb": thumb})

posts.sort(key=lambda p: p["slug"], reverse=True)   # 新しい順
(root / "posts.json").write_text(json.dumps({"posts": posts}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(posts)}件の記事で posts.json を作りました")
