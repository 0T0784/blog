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

# GitHubのIssueに貼った画像（https://github.com/user-attachments/assets/…）のURLも、そのまま使える
IMG_TAG = re.compile(r"<img\b[^>]*\bsrc=[\"']([^\"']+)[\"']", re.I)             # Issueが入れる <img src="…"> の形
IMG_EXT = re.compile(r"\.(png|jpe?g|gif|webp|avif)(\?\S*)?$", re.I)
ASSET = re.compile(r"https://github\.com/user-attachments/assets/\S+$")

def pick_url(s):
    """「images/a.jpg」「https://…」「![image](https://…)」「<img src=…>」のどれからでもURLを取り出す"""
    m = re.search(r"!\[[^\]]*\]\(([^)\s]+)", s) or IMG_TAG.search(s)
    if m:
        return m.group(1)
    return s.strip().split()[0] if s.strip() else ""
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
        s = re.match(r"(?:thumb|サムネ)\s*[:：]\s*(.+)$", l, re.I)   # 「サムネ: images/xxx.jpg」でサムネを指定
        if s:
            explicit = pick_url(s.group(1))
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
        sm = re.match(r"(?:summary|概要)\s*[:：]\s*(.+)$", l, re.I)        # 「概要: 一覧に出す文章」で一覧に出す文章を指定（無ければ何も出さない）
        if sm:
            excerpt = excerpt or sm.group(1).strip()
            continue
        img = re.match(r"!\[.*?\]\((.+?)\)$", l)
        yt = re.search(r"(?:[?&]v=|youtu\.be/|embed/|shorts/|live/)([\w-]{11})", l) if re.match(r"https?://\S+$", l) else None
        himg = IMG_TAG.match(l) if l.startswith("<img") else None
        bare = l if re.match(r"https?://\S+$", l) and (ASSET.match(l) or IMG_EXT.search(l)) else None
        if (img or himg or bare) and not thumb:
            thumb = img.group(1) if img else himg.group(1) if himg else bare
        elif yt and not thumb:
            thumb = f"https://i.ytimg.com/vi/{yt.group(1)}/hqdefault.jpg"
    title = title or f.stem[len(m.group(0)):] or f.stem   # 題名が無いときはファイル名の日付より後ろを使う
    posts.append({"slug": f.stem, "title": title, "date": m.group(1), "excerpt": excerpt, "thumb": explicit or thumb, "tags": tags, "author": author, "v": digest(f.read_bytes()),
                  "hidden": any(w in f.stem.lower() for w in HIDDEN_WORDS)})

posts.sort(key=lambda p: p["slug"], reverse=True)   # 新しい順
(root / "posts.json").write_text(json.dumps({"posts": posts}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(posts)}件の記事で posts.json を作りました")

