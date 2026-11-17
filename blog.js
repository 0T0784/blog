/* ★ ブログ名・ロゴ・ホームはここで変更
   home … ホームのURL（https://〜）。入れると、ロゴを押したときそこへ飛ぶ。空ならロゴは記事一覧へ
   logo … ロゴ画像のパス。画像が無いときはブログ名の文字が出る
   thumb … サムネ未設定の記事に使う画像（images/default.jpg）。画像が無いときは🍁が出る
   brand … ロゴ画像が無いときにヘッダーに出す文字（TOPページと同じ名前にする）
   menu … ヘッダーのメニュー [名前, 行き先]。「#」で始まる行き先は、TOPページ（home）の同じ場所に飛ぶ（home が空なら出ない）
   author … 著者を書いていない記事に使う著者名（空なら表示しない）。アイコンは authors.json で関連付ける */
const SITE={name:"雑記帳",brand:"オト",home:"https://0t0784.github.io/home/",logo:"images/logo.png",thumb:"images/default.jpg",author:"",
  menu:[["私について","#about"],["作品・活動","#works"],["雑記","index.html"],["リンク","#links"]]};
const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const ytId=u=>{const m=u.match(/(?:[?&]v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);return m&&m[1]};
const fmt=d=>d.replace(/-/g,".");

// 共通ヘッダー／フッター
function chrome(cur){
  const H=(SITE.home||"").replace(/#.*$/,"");   // ホームのURL
  const items=SITE.menu.map(([t,h])=>h[0]==="#"?(H?[t,H+h]:null):[t,h]).filter(Boolean);
  document.body.insertAdjacentHTML("afterbegin",
   `<header><nav class="nav" aria-label="メニュー"><a class="logo" href="${esc(H||"index.html")}" aria-label="${H?"ホームへ":"記事一覧へ"}"><img src="${esc(SITE.logo)}" alt="" onerror="this.parentNode.textContent=SITE.brand"></a>
    <ul>${items.map(([t,h])=>`<li><a href="${esc(h)}"${cur&&h==="index.html"?' class="on"':""}>${esc(t)}</a></li>`).join("")}</ul></nav></header>`);
  document.body.insertAdjacentHTML("beforeend",`<footer>© ${SITE.name}</footer>`);
}

// 音声／ダウンロード用ファイルの判定（GitHubのIssueの添付 https://github.com/user-attachments/files/… も対象）
const AU=/\.(mp3|m4a|aac|wav|ogg|opus|flac)(\?\S*)?$/i;
const DLX=/\.(zip|7z|rar|pdf|txt|docx?|xlsx?|pptx?|csv|json|mid|midi|sf2|psd|ai|xcf|apk|exe|dmg|tar|gz)(\?\S*)?$/i;
const ISSUE_FILE=/^https:\/\/github\.com\/user-attachments\/files\/\S+$/;
const dlParse=l=>{   // 「ダウンロード: パス | 表示名」または ファイルのURLだけの行
  const m=l.match(/^(?:ダウンロード|download)\s*[:：]\s*([^|｜]+?)\s*(?:[|｜]\s*(.+))?$/i);
  if(m)return{f:m[1],t:m[2]||""};
  if(/^https?:\/\/\S+$/.test(l)&&!AU.test(l)&&(ISSUE_FILE.test(l)||DLX.test(l)))return{f:l,t:""};
  return null;
};
const dlRow=({f,t})=>{
  const base=decodeURIComponent(f.split("?")[0].split("/").pop()||f), ext=((base.match(/\.([^.]+)$/)||[,"FILE"])[1]).toUpperCase().slice(0,4);
  return `<li class="dlr"><span class="dic" aria-hidden="true">${esc(ext)}</span><span class="dnm"><b>${esc(t||base)}</b><small>${esc(ext)}</small></span><a class="dbtn" href="${esc(f)}" download="${esc(base)}" target="_blank" rel="noopener">${IC.dl}<span>ダウンロード</span></a></li>`;
};

// Markdown（よく使う書き方だけ）→ HTML
const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
function md(src){
  const out=[];let p=[],ul=[],dl=[],dlLabel="",bq=[];
  const used=new Set();   // 見出しの目印（ID）：見出しの文字から作る。同じ文字があれば -2, -3 を付ける
  const hid=t=>{const b=t.replace(/[*_`\[\]()!#<>?.,;:'"“”\/\\&%+=|{}^~]/g,"").trim().replace(/\s+/g,"-")||"midashi";let id=b,n=2;while(used.has(id))id=b+"-"+n++;used.add(id);return id};
  const fp=()=>{if(p.length){out.push("<p>"+p.map(inline).join("<br>")+"</p>");p=[]}};
  const fd=()=>{if(dl.length){out.push(`<div class="dlf"><span class="dtab">${esc(dlLabel||"ダウンロード")}</span><ul>${dl.map(dlRow).join("")}</ul></div>`);dl=[];dlLabel=""}};
  const DIV=/^(?:-{3,}|\*{3,}|_{3,})$/;   // 区切り線（--- や ***）
  const fq=()=>{   // 引用：続けて「> 」で始めた行を1つの引用にまとめる。「>」だけの行で段落を分け、「> ---」で区切り線を入れる
    if(!bq.length)return;
    const parts=[];let cur=[];
    const end=()=>{if(cur.length){parts.push("<p>"+cur.map(inline).join("<br>")+"</p>");cur=[]}};
    bq.forEach(t=>{t=t.trim();if(!t)end();else if(DIV.test(t)){end();parts.push("<hr>")}else cur.push(t)});
    end();out.push("<blockquote>"+parts.join("")+"</blockquote>");bq=[];
  };
  const fl=()=>{if(ul.length){out.push("<ul>"+ul.map(x=>"<li>"+inline(x)+"</li>").join("")+"</ul>");ul=[]}};
  for(const raw of src.split(/\r?\n/)){
    const l=raw.trim();let m;
    if(!l){fp();fl();fq();continue}
    let fo=l.match(/^(?:フォルダ|folder)\s*[:：]\s*(.+)$/i);     // フォルダの見出し（省略可）
    if(fo){fp();fl();fq();dlLabel=fo[1].trim();continue}
    let dd=/^(?:音声|audio)\s*[:：]/i.test(l)?null:dlParse(l);   // 続けて書いたダウンロードは、1つのフォルダにまとめる
    if(dd){fp();fl();fq();dl.push(dd);continue}
    const qm=l.match(/^>\s?(.*)$/);
    if(qm){fp();fl();fd();bq.push(qm[1]);continue}
    fq();
    fd();
    if(DIV.test(l)){fp();fl();out.push("<hr>");continue}
    if(/^#(?!#)\s*\S/.test(l)||/^(thumb|サムネ|tags?|タグ|authors?|著者|summary|概要|目次|toc)\s*[:：]/i.test(l))continue;                                   // 先頭の「# タイトル」は別で表示
    // 音声：「音声: audio/曲.mp3 | 表示するタイトル」または 音声ファイルのURLだけの行 → オリジナルの再生プレイヤー
    let ad=l.match(/^(?:音声|audio)\s*[:：]\s*([^|｜]+?)\s*(?:[|｜]\s*(.+))?$/i);
    if(ad||(/^https?:\/\/\S+$/.test(l)&&AU.test(l))){
      const f=ad?ad[1]:l, t=(ad&&ad[2])||decodeURIComponent(f.split("?")[0].split("/").pop()).replace(/\.[^.]+$/,"");
      fp();fl();out.push(`<div class="aud" data-src="${esc(f)}" data-title="${esc(t)}"></div>`);continue}
    // 画像：![説明](URL) / <img src="URL">（Issueが入れる形） / 画像のURLだけの行 / GitHubのIssueの添付URLだけの行
    let im=l.match(/^!\[(.*?)\]\((.+?)\)$/), src,alt="";
    if(im){alt=im[1];src=im[2]}
    else if(m=l.match(/^<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>$/i)){src=m[1];alt=(l.match(/\balt=["']([^"']*)["']/i)||[,""])[1]}
    else if(/^https:\/\/github\.com\/user-attachments\/assets\/\S+$/.test(l)||/^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i.test(l))src=l;
    if(src){fp();fl();
      if(/^(image|img|画像)$/i.test(alt.trim()))alt="";   // Issueが自動で入れる「image」は説明として出さない
      // 動画をIssueに上げたURLだった場合は、読み込みに失敗するので動画プレーヤーに切り替える
      out.push(`<figure><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="if(!this.dataset.v){this.dataset.v=1;var v=document.createElement('video');v.controls=true;v.src=this.src;v.style.maxWidth='100%';this.replaceWith(v)}">${alt?`<figcaption>${esc(alt)}</figcaption>`:""}</figure>`);continue}
    if(/^https?:\/\/\S+$/.test(l)){fp();fl();const id=ytId(l);                 // 単独行のURL
      out.push(id?`<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube動画" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`
                 :`<p><a href="${esc(l)}" target="_blank" rel="noopener">${esc(l)}</a></p>`);continue}
    if(m=l.match(/^(#{2,3})\s+(.+)/)){fp();fl();const t=m[1].length===2?"h3":"h4";out.push(`<${t} id="${esc(hid(m[2]))}">${inline(m[2])}</${t}>`);continue}
    if(m=l.match(/^[-*]\s+(.+)/)){fp();ul.push(m[1]);continue}
    fl();p.push(l);
  }
  fp();fl();fq();fd();return out.join("\n");
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

// ===== 音声プレイヤー（標準のコントロールは使わず、ブログのデザインに合わせて自作）=====
const IC={
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/></svg>',
  vol:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  dl:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mute:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};
let CURRENT=null;   // 再生中は1つだけ
const mmss=t=>isFinite(t)?`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,"0")}`:"--:--";
function initAudio(root){
  root.querySelectorAll(".aud").forEach(el=>{
    const src=el.dataset.src, title=el.dataset.title;
    el.removeAttribute("data-src");   // ページの中に音声のURLを直接は残さない（簡易的な対策）
    el.innerHTML=`<div class="disc" aria-hidden="true"></div>
      <div class="am"><p class="at">${esc(title)}</p>
        <div class="ac"><button class="pp" type="button" aria-label="再生">${IC.play}</button>
          <input class="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="再生位置" style="--p:0%">
          <span class="tm">0:00 / --:--</span>
          <button class="vb" type="button" aria-label="消音">${IC.vol}</button></div></div>`;
    const a=new Audio(); a.preload="metadata"; a.src=src;
    const pp=el.querySelector(".pp"), sk=el.querySelector(".seek"), tm=el.querySelector(".tm"), vb=el.querySelector(".vb");
    let drag=false;
    const paint=()=>{const d=a.duration,p=isFinite(d)&&d>0?a.currentTime/d*100:0;
      if(!drag){sk.value=p*10}sk.style.setProperty("--p",(drag?sk.value/10:p)+"%");tm.textContent=`${mmss(a.currentTime)} / ${mmss(a.duration)}`};
    pp.onclick=()=>{a.paused?a.play().catch(()=>el.classList.add("err")):a.pause()};
    a.onplay=()=>{if(CURRENT&&CURRENT!==a)CURRENT.pause();CURRENT=a;el.classList.add("playing");pp.innerHTML=IC.pause;pp.setAttribute("aria-label","一時停止")};
    a.onpause=()=>{el.classList.remove("playing");pp.innerHTML=IC.play;pp.setAttribute("aria-label","再生")};
    a.onended=()=>{a.currentTime=0;paint()};
    a.onloadedmetadata=a.ontimeupdate=a.ondurationchange=paint;
    a.onerror=()=>{el.classList.add("err");el.querySelector(".at").textContent=title+"（読み込めませんでした）"};
    sk.oninput=()=>{drag=true;sk.style.setProperty("--p",sk.value/10+"%");if(isFinite(a.duration))a.currentTime=sk.value/1000*a.duration;};
    sk.onchange=()=>{drag=false;paint()};
    vb.onclick=()=>{a.muted=!a.muted;vb.innerHTML=a.muted?IC.mute:IC.vol;vb.setAttribute("aria-label",a.muted?"消音を解除":"消音")};
    el.addEventListener("contextmenu",e=>e.preventDefault());   // 右クリックの「名前を付けて保存」を出さない（簡易的な対策）
  });
}

// ===== ダウンロードのフォルダ：同じサイト内のファイルは、サイズを調べて表示する =====
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB";
function initDownloads(root){
  root.querySelectorAll(".dlr").forEach(li=>{
    const a=li.querySelector(".dbtn"), sm=li.querySelector("small");
    let u;try{u=new URL(a.getAttribute("href"),location.href)}catch(e){return}
    if(u.origin!==location.origin)return;
    fetch(u,{method:"HEAD"}).then(r=>{const n=+r.headers.get("content-length");if(r.ok&&n)sm.textContent+=" ・ "+fmtSize(n)}).catch(()=>{});
  });
}

// ===== 目次（見出し ## と ### から自動で作る） =====
const TOC_MIN=2;   // 見出しがこの数以上あるときだけ出す
function tocMode(src){   // 記事に「目次: なし」と書けば出さない。「目次: あり」なら、見出しが1つでも出す
  const m=(src||"").match(/^(?:目次|toc)\s*[:：]\s*(.+)$/im);if(!m)return"auto";
  const v=m[1].trim().toLowerCase();
  return /^(なし|off|no|false|非表示|0)$/.test(v)?"off":/^(あり|on|yes|true|表示|1)$/.test(v)?"on":"auto";
}
function initToc(root,src){
  const mode=tocMode(src),body=root.querySelector(".body");
  if(!body||mode==="off")return;
  const hs=[...body.querySelectorAll(":scope>h3,:scope>h4")];
  if(hs.length<(mode==="on"?1:TOC_MIN))return;
  let html="<ol>",inLi=false,inSub=false;
  hs.forEach(h=>{
    const a=`<a href="#${esc(h.id)}">${esc(h.textContent)}</a>`;
    if(h.tagName==="H4"&&inLi){if(!inSub){html+="<ol>";inSub=true}html+=`<li>${a}</li>`}
    else{if(inSub){html+="</ol>";inSub=false}if(inLi)html+="</li>";html+=`<li>${a}`;inLi=true}
  });
  if(inSub)html+="</ol>";if(inLi)html+="</li>";html+="</ol>";
  const nav=document.createElement("nav");nav.className="toc";nav.setAttribute("aria-label","目次");
  nav.innerHTML=`<details open><summary>目次</summary>${html}</details>`;
  hs[0].before(nav);   // 最初の見出しの手前（前置きの文章のあと）に置く
}
