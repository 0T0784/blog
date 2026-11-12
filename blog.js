/* ★ ブログ名・ロゴ・ホームはここで変更
   home … ホームのURL（https://〜）。入れると、ロゴを押したときそこへ飛ぶ。空ならロゴは記事一覧へ
   logo … ロゴ画像のパス。画像が無いときはブログ名の文字が出る
   thumb … サムネ未設定の記事に使う画像（images/default.jpg）。画像が無いときは🍁が出る
   author … 著者を書いていない記事に使う著者名（空なら表示しない）。アイコンは authors.json で関連付ける */
const SITE={name:"雑記帳",home:"https://example.com/home.html",logo:"images/logo.png",thumb:"images/default.jpg",author:""};
const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const ytId=u=>{const m=u.match(/(?:[?&]v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);return m&&m[1]};
const fmt=d=>d.replace(/-/g,".");

// 共通ヘッダー／フッター
function chrome(cur){
  document.body.insertAdjacentHTML("afterbegin",
   `<header><nav class="nav" aria-label="メニュー"><a class="logo" href="${SITE.home||"index.html"}" aria-label="${SITE.home?"ホームへ":"記事一覧へ"}"><img src="${SITE.logo}" alt="" onerror="this.parentNode.textContent=SITE.name"></a>
    <ul><li><a href="index.html" class="${cur?"on":""}">雑記</a></li></ul></nav></header>`);
  document.body.insertAdjacentHTML("beforeend",`<footer>© ${SITE.name}</footer>`);
}

// Markdown（よく使う書き方だけ）→ HTML
const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
function md(src){
  const out=[];let p=[],ul=[];
  const fp=()=>{if(p.length){out.push("<p>"+p.map(inline).join("<br>")+"</p>");p=[]}};
  const fl=()=>{if(ul.length){out.push("<ul>"+ul.map(x=>"<li>"+inline(x)+"</li>").join("")+"</ul>");ul=[]}};
  for(const raw of src.split(/\r?\n/)){
    const l=raw.trim();let m;
    if(!l){fp();fl();continue}
    if(/^#(?!#)\s*\S/.test(l)||/^(thumb|サムネ|tags?|タグ|authors?|著者|summary|概要)\s*[:：]/i.test(l))continue;                                   // 先頭の「# タイトル」は別で表示
    if(m=l.match(/^!\[(.*?)\]\((.+?)\)$/)){fp();fl();
      out.push(`<figure><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy">${m[1]?`<figcaption>${esc(m[1])}</figcaption>`:""}</figure>`);continue}
    if(/^https?:\/\/\S+$/.test(l)){fp();fl();const id=ytId(l);                 // 単独行のURL
      out.push(id?`<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube動画" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`
                 :`<p><a href="${esc(l)}" target="_blank" rel="noopener">${esc(l)}</a></p>`);continue}
    if(m=l.match(/^(#{2,3})\s+(.+)/)){fp();fl();const t=m[1].length===2?"h3":"h4";out.push(`<${t}>${inline(m[2])}</${t}>`);continue}
    if(m=l.match(/^[-*]\s+(.+)/)){fp();ul.push(m[1]);continue}
    if(m=l.match(/^>\s?(.*)/)){fp();fl();out.push("<blockquote>"+inline(m[1])+"</blockquote>");continue}
    fl();p.push(l);
  }
  fp();fl();return out.join("\n");
}
const getPosts=()=>fetch("posts.json",{cache:"no-store"}).then(r=>r.json()).then(j=>j.posts);

// 記事番号（古い記事から数えた番号。一覧に出ない記事は、その記事自身のページでだけ数に入れる）
const noOf=(ps,p)=>{const v=ps.filter(x=>!x.hidden||x.slug===p.slug);return String(v.length-v.findIndex(x=>x.slug===p.slug)).padStart(2,"0")};

// 著者とアイコン（authors.json の { "名前": "アイコン画像のパス" }）
const getAuthors=()=>fetch("authors.json",{cache:"no-store"}).then(r=>r.ok?r.json():{}).catch(()=>({}));
const authorOf=p=>p.author||SITE.author||"";
const avatar=(name,auth)=>{
  const src=auth&&auth[name], ini=esc([...name][0]||"?");
  return `<span class="av">${src?`<img src="${esc(src)}" alt="" data-i="${ini}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:this.dataset.i}))">`:`<b>${ini}</b>`}</span>`;
};
