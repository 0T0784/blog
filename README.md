# 記事の追加のしかた
1. posts/ に「2026-11-12-好きな名前.md」を作る（先頭の日付が記事の日付）
2. 1行目に「# タイトル」、あとは普通に文章を書く
3. 写真は images/ に置いて ![説明](images/ファイル名.jpg)
4. YouTubeはURLだけを1行で貼る
5. GitHubにpush（posts.json は自動で作られます。手元で確認したいときだけ python make_posts.py）

ブログ名は blog.js の SITE.name、2つのHTMLの <title> で変更。
最初に1回だけ: GitHub → Settings → Pages → Source を「GitHub Actions」にする。

ホームのURLを入れたいとき: blog.js の SITE.home に https://〜 を書く（空ならメニューに出ません）。

# サムネイル
- 何も書かなければ、記事の最初の写真（なければYouTubeの画像）が自動で使われる
- 指定したいときは、記事のどこかに1行「サムネ: images/ファイル名.jpg」と書く（本文には表示されない）
- どれも無い記事は images/default.jpg が使われる（blog.js の SITE.thumb で変更可）
