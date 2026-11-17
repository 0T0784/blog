/* スマホでも使える記事エディタ（editor.html）
   記事の .md と、写真・音声・ファイルを、GitHub API で1回のcommitにまとめて送る → 自動で公開される */
const $=id=>document.getElementById(id);
const CFGK="blog_editor_cfg", DRAFTK="blog_editor_draft";
let cfg={repo:"",branch:"main",token:"",shrink:true};
try{Object.assign(cfg,JSON.parse(localStorage.getItem(CFGK)||"{}"))}catch(e){}
let cur=null;                 // いま開いている記事のパス（新規なら null）
let pending=new Map();        // まだ送っていない添付 { パス → {blob, name} }
let blobUrls=new Map();       // プレビュー用 { パス → blob URL }
let ALLP=[], hiddenWords=["test","private"], slugAuto=true, busy=false;

// ---------- 小道具 ----------
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`};
const slugify=t=>{const s=t.replace(/[\\/:*?"<>|#%&{}$!'`@+=,;\[\]^~().（）「」『』【】。、！？・]/g,"").trim().replace(/\s+/g,"-");return s.slice(0,24)||"post"};
const splitTags=s=>[...new Set(s.split(/[,、，\s]+/).map(t=>t.trim().replace(/^[#＃]/,"")).filter(Boolean))];
const safeName=n=>n.replace(/\s+/g,"_").replace(/[\\/:*?"<>|#%]/g,"");
let toastT;
function toast(html,err=false,ms=4500){
  document.querySelectorAll(".toast").forEach(e=>e.remove());
  const t=document.createElement("div");t.className="toast"+(err?" err":"");t.innerHTML=html;document.body.append(t);
  clearTimeout(toastT);if(ms)toastT=setTimeout(()=>t.remove(),ms);
}

// ---------- 記事ファイルの読み書き（パソコン版エディタと同じ形式） ----------
const RE={title:/^#(?!#)\s*(\S.*)$/,tags:/^(?:tags?|タグ)\s*[:：]\s*(.+)$/i,author:/^(?:authors?|著者)\s*[:：]\s*(.+)$/i,summary:/^(?:summary|概要)\s*[:：]\s*(.+)$/i,thumb:/^(?:thumb|サムネ)\s*[:：]\s*(.+)$/i};
function parsePost(text){
  const d={title:"",tags:[],author:"",summary:"",thumb:""},body=[];
  for(const line of text.replace(/^\ufeff/,"").split(/\r?\n/)){
    const l=line.trim();let m;
    if(!d.title&&(m=l.match(RE.title))){d.title=m[1].trim();continue}
    if(m=l.match(RE.tags)){splitTags(m[1]).forEach(t=>d.tags.includes(t)||d.tags.push(t));continue}
    if(m=l.match(RE.author)){d.author=m[1].trim();continue}
    if(m=l.match(RE.summary)){d.summary=m[1].trim();continue}
    if(m=l.match(RE.thumb)){d.thumb=m[1].trim();continue}
    body.push(line);
  }
  return [d,body.join("\n").replace(/^\n+|\n+$/g,"")];
}
function buildPost(d,body){
  const L=[`# ${d.title}`];
  if(d.tags.length)L.push("タグ: "+d.tags.join(", "));
  if(d.author)L.push("著者: "+d.author);
  if(d.summary)L.push("概要: "+d.summary);
  if(d.thumb)L.push("サムネ: "+d.thumb);
  return L.join("\n")+"\n\n"+body.replace(/^\n+|\n+$/g,"")+"\n";
}
const form=()=>({title:$("t").value.trim(),date:$("d").value,slug:$("s").value.trim(),tags:splitTags($("g").value),author:$("a").value.trim(),summary:$("m").value.trim(),thumb:$("th").value.trim(),body:$("b").value});
function setForm(f){
  $("t").value=f.title||"";$("d").value=f.date||todayStr();$("s").value=f.slug||"";$("g").value=(f.tags||[]).join(", ");
  $("a").value=f.author||"";$("m").value=f.summary||"";$("th").value=f.thumb||"";$("b").value=f.body||"";
  hint();chips();
}

// ---------- 画面の切り替え ----------
function show(p){
  document.querySelectorAll(".pane").forEach(e=>e.classList.toggle("on",e.id==="p-"+p));
  document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.p===p));
  if(p==="pv")preview();if(p==="list")loadList();
  scrollTo(0,0);
}
$("tabs").addEventListener("click",e=>{const b=e.target.closest("button");if(b)show(b.dataset.p)});
$("pvBtn").onclick=()=>show("pv");

// ---------- 入力の補助 ----------
function hint(){
  const s=$("s").value.toLowerCase(),hit=hiddenWords.find(w=>s.includes(w));
  $("shint").innerHTML=hit?`<span style="color:var(--maple)">※ファイル名に「${esc(hit)}」が入っているので、一覧には出ず、検索したときだけ表示されます</span>`:"日付のあとに付く名前です（記事のURLになります）";
}
function chips(){
  const have=splitTags($("g").value),all={};
  ALLP.filter(p=>!p.hidden).forEach(p=>(p.tags||[]).forEach(t=>all[t]=(all[t]||0)+1));
  $("gchips").innerHTML=Object.keys(all).sort((a,b)=>all[b]-all[a]).filter(t=>!have.includes(t)).map(t=>`<button type="button" data-t="${esc(t)}">+ ${esc(t)}</button>`).join("");
}
$("gchips").addEventListener("click",e=>{const t=e.target.closest("button")?.dataset.t;if(t){$("g").value=[...splitTags($("g").value),t].join(", ");chips();save()}});
$("g").addEventListener("input",chips);
$("t").addEventListener("input",()=>{if(slugAuto)$("s").value=$("t").value.trim()?slugify($("t").value):"";hint()});
$("s").addEventListener("input",()=>{slugAuto=false;hint()});
$("today").onclick=()=>{$("d").value=todayStr();save()};

// 本文に入れる
const ta=$("b");
function insert(s,{block=false}={}){
  const a=ta.selectionStart,b=ta.selectionEnd,v=ta.value;
  const pre=block&&a>0&&!v.slice(0,a).endsWith("\n\n")?(v.slice(0,a).endsWith("\n")?"\n":"\n\n"):"";
  const post=block?"\n\n":"";
  ta.value=v.slice(0,a)+pre+s+post+v.slice(b);
  const pos=a+pre.length+s.length+post.length;ta.focus();ta.setSelectionRange(pos,pos);save();
}
function wrap(l,r){const a=ta.selectionStart,b=ta.selectionEnd,v=ta.value;ta.value=v.slice(0,a)+l+v.slice(a,b)+r+v.slice(b);ta.focus();ta.setSelectionRange(a+l.length,b+l.length);save()}
function prefix(p){const a=ta.selectionStart,v=ta.value,ls=v.lastIndexOf("\n",a-1)+1;ta.value=v.slice(0,ls)+p+v.slice(ls);ta.focus();ta.setSelectionRange(a+p.length,a+p.length);save()}
function pickFile(accept,multiple=true){
  return new Promise(res=>{const i=document.createElement("input");i.type="file";i.accept=accept;i.multiple=multiple;i.onchange=()=>res([...i.files]);i.click()});
}
// 写真を小さくする
async function shrink(file){
  if(!cfg.shrink||!/^image\/(jpeg|png|webp)$/.test(file.type))return file;
  const bmp=await createImageBitmap(file,{imageOrientation:"from-image"}).catch(()=>null);
  if(!bmp)return file;
  const r=Math.min(1,1600/Math.max(bmp.width,bmp.height));
  if(r===1&&file.size<1.2e6&&file.type!=="image/png")return file;
  if(r===1&&file.type==="image/png"&&file.size<1.5e6)return file;
  const c=document.createElement("canvas");c.width=Math.round(bmp.width*r);c.height=Math.round(bmp.height*r);
  const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(bmp,0,0,c.width,c.height);
  const blob=await new Promise(res=>c.toBlob(res,"image/jpeg",.85));
  return blob&&blob.size<file.size?new File([blob],file.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}):file;
}
function addPending(dir,file){
  const path=`${dir}/${stamp()}-${safeName(file.name)}`;
  let p=path,n=2;while(pending.has(p))p=path.replace(/(\.[^./]*)?$/,`_${n++}$1`);
  pending.set(p,{blob:file,name:file.name});blobUrls.set(p,URL.createObjectURL(file));return p;
}
async function insPhoto(){
  const fs=await pickFile("image/*");if(!fs.length)return;
  toast("写真を処理しています…",false,0);
  for(const f of fs){const s=await shrink(f);insert(`![](${addPending("images",s)})`,{block:true})}
  toast(`写真を${fs.length}枚追加しました（公開するときに送られます）`);
}
$("thPick").onclick=async()=>{const [f]=await pickFile("image/*",false);if(!f)return;toast("処理しています…",false,0);$("th").value=addPending("images",await shrink(f));toast("サムネを設定しました");save()};
async function insAudio(){
  for(const f of await pickFile("audio/*,.mp3,.m4a,.wav,.ogg,.flac")){
    const t=prompt("プレイヤーに出すタイトル",f.name.replace(/\.[^.]+$/,""));if(t===null)continue;
    insert(`音声: ${addPending("audio",f)} | ${t||f.name.replace(/\.[^.]+$/,"")}`,{block:true});
  }
}
async function insFile(){
  const fs=await pickFile("*/*");if(!fs.length)return;
  const label=prompt("フォルダの見出し（空なら「ダウンロード」）","")||"";
  const L=label?[`フォルダ: ${label}`]:[];
  for(const f of fs)L.push(`ダウンロード: ${addPending("downloads",f)} | ${f.name}`);
  insert(L.join("\n"),{block:true});
}
const TOOLS=[["見出し",()=>prefix("## ")],["太字",()=>wrap("**","**")],["リンク",()=>{const u=prompt("リンク先のURL");if(!u)return;const s=ta.value.slice(ta.selectionStart,ta.selectionEnd)||prompt("リンクの文字")||u;insert(`[${s}](${u})`)}],
  ["引用",()=>prefix("> ")],["リスト",()=>prefix("- ")],["写真",insPhoto],["YouTube",()=>{const u=prompt("YouTubeのURL");if(u)insert(u.trim(),{block:true})}],
  ["音声",insAudio],["ファイル",insFile],["追記",()=>{const d=todayStr().replace(/-/g,"/");insert(`${d} 追記: `,{block:true})}]];
TOOLS.forEach(([n,f])=>{const b=document.createElement("button");b.type="button";b.textContent=n;b.onclick=f;$("tool").append(b)});

// ---------- 下書き（うっかり閉じても残る） ----------
let dt;function save(){clearTimeout(dt);dt=setTimeout(()=>{try{localStorage.setItem(DRAFTK,JSON.stringify({...form(),cur,at:Date.now()}))}catch(e){}},400)}
["t","d","s","g","a","m","th","b"].forEach(id=>$(id).addEventListener("input",save));
function restoreDraft(){
  try{const d=JSON.parse(localStorage.getItem(DRAFTK)||"null");
    if(d&&(d.title||d.body)){cur=d.cur||null;slugAuto=!d.slug;setForm(d);$("draftNote").hidden=false;
      $("draftNote").innerHTML=`下書きを復元しました。<a href="#" id="dd">破棄して新しく書く</a>${/(images|audio|downloads)\//.test(d.body)?"<br>※ 前に選んだ写真・音声・ファイルは、公開前に閉じると送られていません。もう一度選んでください。":""}`;
      $("dd").onclick=e=>{e.preventDefault();newPost(true)}}
  }catch(e){}
}

// ---------- プレビュー ----------
async function preview(){
  const f=form(),box=$("pvBox");
  if(!f.title&&!f.body){box.innerHTML='<p class="card">書くタブで入力すると、ここに表示されます。</p>';return}
  const auth=await getAuthors(),au=f.author||SITE.author||"";
  box.innerHTML=`<article class="sheet"><header><div class="lb"><p class="label">${esc(f.date.replace(/-/g,"."))} ・ プレビュー</p>${f.tags.length?`<div class="tgs">${f.tags.map(t=>`<span class="tg">#${esc(t)}</span>`).join("")}</div>`:""}</div><h1>${esc(f.title||"（題名なし）")}</h1></header>
    <div class="body">${md(f.body)}</div>${au?`<div class="by"><div class="au">${avatar(au,auth)}<span>${esc(au)}</span></div></div>`:""}</article>`;
  // まだ送っていない添付は、この端末の中のデータで表示する
  box.querySelectorAll("img").forEach(i=>{const u=blobUrls.get(i.getAttribute("src"));if(u)i.src=u});
  box.querySelectorAll(".aud").forEach(a=>{const u=blobUrls.get(a.dataset.src);if(u)a.dataset.src=u});
  box.querySelectorAll(".dbtn").forEach(a=>{const u=blobUrls.get(a.getAttribute("href"));if(u)a.href=u});
  initAudio(box);
}

// ---------- 一覧・開く ----------
async function loadList(){
  try{
    const j=await fetch("posts.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json());ALLP=j.posts;chips();
    const L=$("plist");
    L.innerHTML=ALLP.map(p=>`<li data-s="${esc(p.slug)}"><time>${esc(p.date.replace(/-/g,"."))}</time><b>${esc(p.title)}</b></li>`).join("")||'<li style="cursor:default">まだ記事がありません</li>';
  }catch(e){$("plist").innerHTML='<li style="cursor:default">一覧を読み込めませんでした</li>'}
}
$("plist").addEventListener("click",async e=>{
  const li=e.target.closest("li[data-s]");if(!li)return;
  if(!confirm("いま書いている内容は、この記事に置き換わります。よろしいですか？"))return;
  try{
    const slug=li.dataset.s,t=await fetch(`posts/${encodeURIComponent(slug)}.md?t=${Date.now()}`,{cache:"no-store"}).then(r=>{if(!r.ok)throw 0;return r.text()});
    const [d,body]=parsePost(t),m=slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    pending=new Map();cur=`posts/${slug}.md`;slugAuto=false;
    setForm({...d,body,date:m?m[1]:todayStr(),slug:m?m[2]:slug});$("draftNote").hidden=true;save();show("write");
  }catch(err){toast("記事を読み込めませんでした",true)}
});
$("reload").onclick=loadList;
function newPost(force){
  if(!force&&!confirm("いま書いている内容を消して、新しい記事を始めます。よろしいですか？"))return;
  cur=null;pending=new Map();slugAuto=true;setForm({date:todayStr()});$("draftNote").hidden=true;
  try{localStorage.removeItem(DRAFTK)}catch(e){}show("write");
}
$("newBtn").onclick=()=>newPost(false);

// ---------- GitHub ----------
function friendly(e){
  const m=String(e.message||e);
  if(/^401/.test(m))return "トークンが正しくないか、期限が切れています。設定で入れ直してください。";
  if(/^(403|404)/.test(m))return "権限がありません。トークンに、このリポジトリの Contents（Read and write）の権限があるか、リポジトリ名が合っているか確認してください。";
  if(/Failed to fetch|NetworkError/i.test(m))return "通信できませんでした。電波の状態を確認して、もう一度お試しください。";
  return m;
}
async function gh(path,opt={}){
  const r=await fetch("https://api.github.com"+path,{...opt,headers:{Authorization:"Bearer "+cfg.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"}});
  if(!r.ok)throw new Error(`${r.status} ${(await r.text()).slice(0,160)}`);
  return r.status===204?null:r.json();
}
const b64=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(blob)});
const utf8b64=s=>{const b=new TextEncoder().encode(s);let x="";b.forEach(c=>x+=String.fromCharCode(c));return btoa(x)};

/* files: [{path, blob|text}] / deletes: [path] を、1つのcommitにして送る */
async function commit(files,deletes,message,onStep){
  const R=`/repos/${cfg.repo}`;
  onStep("準備しています…");
  const ref=await gh(`${R}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
  const base=await gh(`${R}/git/commits/${ref.object.sha}`);
  const tree=[];
  let n=0;
  for(const f of files){
    onStep(`送信しています… (${++n}/${files.length})`);
    const content=f.text!=null?utf8b64(f.text):await b64(f.blob);
    const bl=await gh(`${R}/git/blobs`,{method:"POST",body:JSON.stringify({content,encoding:"base64"})});
    tree.push({path:f.path,mode:"100644",type:"blob",sha:bl.sha});
  }
  deletes.forEach(p=>tree.push({path:p,mode:"100644",type:"blob",sha:null}));
  onStep("まとめています…");
  const t=await gh(`${R}/git/trees`,{method:"POST",body:JSON.stringify({base_tree:base.tree.sha,tree})});
  const c=await gh(`${R}/git/commits`,{method:"POST",body:JSON.stringify({message,tree:t.sha,parents:[ref.object.sha]})});
  await gh(`${R}/git/refs/heads/${encodeURIComponent(cfg.branch)}`,{method:"PATCH",body:JSON.stringify({sha:c.sha})});
}

// ---------- 公開 ----------
$("pub").onclick=async()=>{
  if(busy)return;
  if(!cfg.token||!cfg.repo){toast("先に、設定（⚙）でリポジトリとトークンを入れてください",true);show("set");return}
  const f=form();
  if(!f.title){toast("題名を入力してください",true);show("write");return}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f.date)){toast("日付を入力してください",true);show("write");return}
  const slug=(f.slug||slugify(f.title)).replace(/[\\/:*?"<>|.]/g,"")||"post";
  const path=`posts/${f.date}-${slug}.md`;
  if(path!==cur&&ALLP.some(p=>`posts/${p.slug}.md`===path)&&!confirm(`「${path.slice(6)}」はもうあります。上書きしますか？`))return;
  const text=buildPost({title:f.title,tags:f.tags,author:f.author,summary:f.summary,thumb:f.thumb},f.body);
  const used=[...pending].filter(([p])=>text.includes(p));          // 記事で使っている添付だけを送る
  const files=[{path,text},...used.map(([p,v])=>({path:p,blob:v.blob}))];
  const dels=cur&&cur!==path?[cur]:[];
  busy=true;$("pub").disabled=true;
  try{
    await commit(files,dels,`記事：${f.title}`,s=>toast(s,false,0));
    used.forEach(([p])=>pending.delete(p));cur=path;
    try{localStorage.removeItem(DRAFTK)}catch(e){}
    $("draftNote").hidden=true;
    toast(`公開しました。1〜2分で反映されます。<br><a href="post.html?p=${encodeURIComponent(path.slice(6,-3))}" target="_blank" rel="noopener">記事を開く</a>`,false,9000);
    loadList();
  }catch(e){toast("うまくいきませんでした。<br>"+esc(friendly(e)),true,9000)}
  finally{busy=false;$("pub").disabled=false}
};

// ---------- 設定 ----------
function guess(){
  const h=location.hostname,m=h.match(/^([^.]+)\.github\.io$/);
  if(!m)return "";const seg=location.pathname.split("/")[1];
  return m[1]+"/"+(seg&&!/\.html?$/.test(seg)?seg:h);
}
$("cr").value=cfg.repo||guess();$("cb").value=cfg.branch||"main";$("ct").value=cfg.token||"";$("cz").checked=cfg.shrink!==false;
$("cz").onchange=()=>{cfg.shrink=$("cz").checked;localStorage.setItem(CFGK,JSON.stringify(cfg))};
$("cs").onclick=async()=>{
  cfg={repo:$("cr").value.trim().replace(/^https?:\/\/github\.com\//,"").replace(/\/$/,""),branch:$("cb").value.trim()||"main",token:$("ct").value.trim(),shrink:$("cz").checked};
  try{localStorage.setItem(CFGK,JSON.stringify(cfg))}catch(e){}
  const out=$("cres");out.hidden=false;out.textContent="確認しています…";
  try{
    const r=await gh(`/repos/${cfg.repo}`);
    out.innerHTML=r.permissions&&r.permissions.push===false?`<b class="danger">接続できましたが、書き込みの権限がありません。</b><br>トークンの Contents を「Read and write」にしてください。`:`<b>接続できました：${esc(r.full_name)}</b><br>これで、公開できます。`;
  }catch(e){out.innerHTML=`<b class="danger">接続できませんでした。</b><br>${esc(friendly(e))}`}
};
$("cx").onclick=()=>{if(!confirm("この端末に保存したトークンを消します。よろしいですか？"))return;cfg.token="";$("ct").value="";localStorage.setItem(CFGK,JSON.stringify(cfg));toast("トークンを消しました")};

// ---------- 起動 ----------
(async()=>{
  $("d").value=todayStr();
  try{const mp=await fetch("make_posts.py",{cache:"no-store"}).then(r=>r.text()),m=mp.match(/HIDDEN_WORDS\s*=\s*\[(.*?)\]/s);if(m)hiddenWords=[...m[1].matchAll(/["']([^"']+)["']/g)].map(x=>x[1].toLowerCase())}catch(e){}
  try{const j=await fetch("posts.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json());ALLP=j.posts}catch(e){}
  const au=await getAuthors();$("alist").innerHTML=Object.keys(au).map(n=>`<option value="${esc(n)}">`).join("");
  restoreDraft();chips();hint();
  if(!cfg.token)setTimeout(()=>toast("最初に、⚙ の設定でトークンを入れてください",false,6000),600);
})();
