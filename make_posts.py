"""posts/ の記事(.md)を読んで、記事一覧 posts.json を作る。記事を足したら実行するだけ。
  python make_posts.py
ファイル名: 2026-11-12-好きな名前.md （先頭の日付が記事の日付になる）
"""
import hashlib, json, re, pathlib

root = pathlib.Path(__file__).parent

def digest(b):   # 中身が変わると変わる短い印（ブラウザの古いキャッシュを避けるために使う）
    return hashlib.md5(b).hexdigest()[:8]
# ファイル名にこの言葉が入っている記事は、一覧には出さず「検索したときだけ」表示する（大文字小文字は区別しない）
HIDDEN_WORDS = ["test", "private"]
posts = []
for f in sorted((root / "posts").glob("*.md")):
    m = re.match(r"(\d{4}-\d{2}-\d{2})-", f.stem)
    if not m:
        print(f"スキップ: {f.name}（ファイル名を 2026-11-12-名前.md の形にしてね）")
        continue
    text = f.read_text(encoding="utf-8-sig")   # Windowsのメモ帳が付けるBOMも許容
    title, excerpt, thumb, explicit, tags, author = "", "", "", "", [], ""
    for line in text.splitlines():
        l = line.strip()
        if not l:
            continue
        t = re.match(r"#(?!#)\s*(\S.*)", l)          # 「# 題名」「#題名」どちらもOK（## は見出し扱い）
        if t and not title:
            title = t.group(1).strip()
            continue
        s = re.match(r"(?:thumb|サムネ)\s*[:：]\s*(\S+)$", l, re.I)   # 「サムネ: images/xxx.jpg」でサムネを指定
        if s:
            explicit = s.group(1)
            continue
        tg = re.match(r"(?:tags?|タグ)\s*[:：]\s*(.+)$", l, re.I)       # 「タグ: 日常, 音楽」でタグを指定（複数OK）
        if tg:
            for t in re.split(r"[,、，\s]+", tg.group(1)):
                t = t.strip().lstrip("#＃")
                if t and t not in tags:
                    tags.append(t)
            continue
        au = re.match(r"(?:authors?|著者)\s*[:：]\s*(.+)$", l, re.I)       # 「著者: 名前」で著者を指定（アイコンは authors.json で関連付け）
        if au:
            author = au.group(1).strip()
            continue
        img = re.match(r"!\[.*?\]\((.+?)\)$", l)
        yt = re.search(r"(?:[?&]v=|youtu\.be/|embed/|shorts/|live/)([\w-]{11})", l) if re.match(r"https?://\S+$", l) else None
        if img and not thumb:
            thumb = img.group(1)
        elif yt and not thumb:
            thumb = f"https://i.ytimg.com/vi/{yt.group(1)}/hqdefault.jpg"
        elif not excerpt and not img and not yt and not re.match(r"(#|[-*>] |https?://)", l):
            excerpt = re.sub(r"[*\[\]]|\(https?:[^)]*\)", "", l)[:120]
    title = title or f.stem[len(m.group(0)):] or f.stem   # 題名が無いときはファイル名の日付より後ろを使う
    posts.append({"slug": f.stem, "title": title, "date": m.group(1), "excerpt": excerpt, "thumb": explicit or thumb, "tags": tags, "author": author, "v": digest(f.read_bytes()),
                  "hidden": any(w in f.stem.lower() for w in HIDDEN_WORDS)})

posts.sort(key=lambda p: p["slug"], reverse=True)   # 新しい順
(root / "posts.json").write_text(json.dumps({"posts": posts}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(posts)}件の記事で posts.json を作りました")

# CSS/JS の読み込みURLに、中身の印（?v=）を自動でつける → 更新したら必ず新しいものが読み込まれる
for page in ("index.html", "post.html"):
    p = root / page
    if not p.exists():
        continue
    s = p.read_text(encoding="utf-8")
    for asset in ("blog.css", "blog.js"):
        a = root / asset
        if a.exists():
            s = re.sub(re.escape(asset) + r'(\?v=[^"\']*)?(?=["\'])', f"{asset}?v={digest(a.read_bytes())}", s)
    p.write_text(s, encoding="utf-8")
