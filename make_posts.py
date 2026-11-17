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

PREVIEW_MAX = 150   # 左上の大きいカードに出す本文の文字数
DATE_NOTE = re.compile(r"[（(【\[]?\s*\d{4}\s*[/.\-年]\s*\d{1,2}")   # 「2026/11/20 追記」のような日付で始まる行

# 「2026/11/21 追記: …」「【追記】…」のような追記の表記（「追記しました」「更新頻度」のような普通の文は対象外）
NOTE_RE = re.compile(r"[（(【\[]?(?:\d{4}\s*[/.\-年]\s*\d{1,2}\s*[/.\-月]\s*\d{1,2}日?)?\s*[）)】\]]?\s*[（(【\[]?追記[）)】\]]?(?![ぁ-んァ-ヶ一-龠])")
NOTICE_MAX = 36

def clean(s):
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)           # 画像を消す
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)        # [文字](URL) → 文字
    s = re.sub(r"\*\*|__|`", "", s)                        # 太字などの記号
    return re.sub(r"^[-*]\s+", "", s).strip()

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
    body, brk, note = [], False, ""
    for line in text.splitlines():
        l = line.strip()
        if not l:
            brk = True
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
        if re.match(r"(?:目次|toc)\s*[:：]", l, re.I):      # 「目次: なし」などの設定の行（一覧には使わない）
            continue
        img = re.match(r"!\[.*?\]\((.+?)\)$", l)
        yt = re.search(r"(?:[?&]v=|youtu\.be/|embed/|shorts/|live/)([\w-]{11})", l) if re.match(r"https?://\S+$", l) else None
        himg = IMG_TAG.match(l) if l.startswith("<img") else None
        bare = l if re.match(r"https?://\S+$", l) and (ASSET.match(l) or IMG_EXT.search(l)) else None
        if (img or himg or bare) and not thumb:
            thumb = img.group(1) if img else himg.group(1) if himg else bare
        elif yt and not thumb:
            thumb = f"https://i.ytimg.com/vi/{yt.group(1)}/hqdefault.jpg"
        if NOTE_RE.match(l):                       # 追記の表記は、いちばん最後（＝新しい）ものを覚えておく
            note = clean(l)
        # 本文の文章（見出し・画像・URL・「日付＋追記」の行は除く）を、大きいカード用に集める
        if img or himg or bare or yt or l.startswith(("#", "<", ">", "|", "```", "---", "***", "___")) or re.match(r"https?://\S+$", l) or re.match(r"(?:音声|audio|ダウンロード|download|フォルダ|folder)\s*[:：]", l, re.I):
            continue
        if DATE_NOTE.match(l) or re.search(r"追記|更新", l[:12]):
            continue
        txt = clean(l)
        if txt:
            body.append((" " if brk and body else "") + txt)
            brk = False
    if "追記" in excerpt:                           # 概要に「追記」と書いてあれば、それを優先
        note = excerpt
    if len(note) > NOTICE_MAX:
        note = note[:NOTICE_MAX].rstrip() + "…"
    preview = "".join(body)
    if len(preview) > PREVIEW_MAX:
        preview = preview[:PREVIEW_MAX].rstrip() + "…"
    title = title or f.stem[len(m.group(0)):] or f.stem   # 題名が無いときはファイル名の日付より後ろを使う
    posts.append({"slug": f.stem, "title": title, "date": m.group(1), "excerpt": excerpt, "preview": preview, "notice": note, "thumb": explicit or thumb, "tags": tags, "author": author, "v": digest(f.read_bytes()),
                  "hidden": any(w in f.stem.lower() for w in HIDDEN_WORDS)})

posts.sort(key=lambda p: p["slug"], reverse=True)   # 新しい順
(root / "posts.json").write_text(json.dumps({"posts": posts}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(posts)}件の記事で posts.json を作りました")

