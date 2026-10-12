/* {{BRAND_SHORT}} admin: website content manager (promotions, menu, singers & line-up, banner, bulk vouchers).
   Content is stored in Supabase table site_content (one JSON document per key) and read live by {{DOMAIN}}. */
(function(){
const KEYS=['menu','singers','week','promos','banner'];
let C={}, LOADED=false, MENU_CAT=0;
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TAGS=['','Favourite','Signature','New','Best value','Spicy','Chef pick'];
const slugify=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||('promo-'+Date.now());
const clone=o=>JSON.parse(JSON.stringify(o));
const val=id=>{const e=document.getElementById(id);return e?e.value:''};
const imgSrc=v=>!v?'':(/^https?:/.test(v)?v:'/img/'+v+'.jpg');
const thumb=v=>v?`<img class="thumb" src="${esc(imgSrc(v))}" onerror="this.style.visibility='hidden'">`:'<span class="thumb" style="display:inline-block"></span>';

async function load(force){
  if(LOADED&&!force) return;
  const {data,error}=await sb.from('site_content').select('*');
  if(error){C={};LOADED=false;throw error}
  C={}; (data||[]).forEach(r=>C[r.key]=r.data); LOADED=true;
}
function missing(){return KEYS.filter(k=>C[k]===undefined)}
async function save(key,msgId){
  const {error}=await sb.from('site_content').upsert({key,data:C[key]});
  msg(msgId,error?('Not saved: '+error.message):'Saved. It is live on {{DOMAIN}} now (refresh the website to see it).',!error);
  return !error;
}
async function undo(key,msgId,after){
  const {data,error}=await sb.from('site_content_history').select('*').eq('key',key).order('id',{ascending:false}).limit(1);
  if(error||!data||!data.length) return msg(msgId,'No earlier version to go back to.');
  if(!window.confirm('Go back to the version saved '+new Date(data[0].saved_at).toLocaleString('en-GB')+'?')) return;
  C[key]=data[0].data; if(await save(key,msgId)) after();
}
async function importSeed(boxId){
  msg(boxId,'Importing…',true);
  try{
    const r=await fetch('/content_seed_v2.json',{cache:'no-store'}); const seed=await r.json();
    for(const k of missing()){ const {error}=await sb.from('site_content').upsert({key:k,data:seed[k]}); if(error) throw error; }
    await load(true); msg(boxId,'Done. Current website content imported.',true); setTimeout(()=>CM.open(CUR),600);
  }catch(e){msg(boxId,'Import failed: '+e.message)}
}
async function uploadImage(file){
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(file)});
  const max=1400, sc=Math.min(1,max/Math.max(img.width,img.height));
  const cv=document.createElement('canvas'); cv.width=Math.round(img.width*sc); cv.height=Math.round(img.height*sc);
  cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
  const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.85));
  const path=new Date().toISOString().slice(0,10)+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,7)+'.jpg';
  const {error}=await sb.storage.from('site-images').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});
  if(error) throw error;
  return sb.storage.from('site-images').getPublicUrl(path).data.publicUrl;
}
// one hidden file input reused for all uploads
const fileIn=document.createElement('input'); fileIn.type='file'; fileIn.accept='image/jpeg,image/png,image/webp'; fileIn.style.display='none'; document.body.appendChild(fileIn);
function pickImage(onUrl,msgId){
  fileIn.value=''; fileIn.onchange=async()=>{const f=fileIn.files[0]; if(!f) return; msg(msgId,'Uploading photo…',true);
    try{const url=await uploadImage(f); onUrl(url); msg(msgId,'Photo uploaded. Press Save to publish.',true);}catch(e){msg(msgId,'Upload failed: '+e.message)}};
  fileIn.click();
}
let CUR='promos';
const header=(title,sub)=>`<div class="card"><h2>${title}</h2><p class="muted">${sub}</p><div id="cm-import"></div></div>`;
function needImport(el){
  const m=missing(); if(!m.length) return false;
  el.insertAdjacentHTML('afterbegin',`<div class="card"><h2>Set up website content</h2><p>The website content has not been loaded into the admin yet. Press the button once to copy the current menu, singers, line-up and promotions from the live website.</p><button class="btn" id="cm-seed">Import current website content</button><div id="cm-seed-msg"></div></div>`);
  document.getElementById('cm-seed').onclick=()=>importSeed('cm-seed-msg'); return true;
}

/* ---------------- PROMOTIONS ---------------- */
function renderPromos(){
  const el=document.getElementById('t-promos');
  el.innerHTML=header('Promotions','Shown on the home page and the Promotions page. Turn a promotion off, or set an end date, and it disappears from the website automatically. Tick "members can claim a voucher" to let signed-in members tap Claim on their member page.');
  if(needImport(el)) return;
  const P=C.promos||(C.promos=[]); const t=todayISO();
  el.insertAdjacentHTML('beforeend',P.map((p,i)=>{const live=p.active!==false&&(!p.start||p.start<=t)&&(!p.end||p.end>=t); const v=p.voucher||{};
    const link=(p.cta&&p.cta[1])||'#book'; const linkType=['#book','#menu','#promos','WA'].includes(link)?link:(link.startsWith('https://wa.me')?'WA':'custom');
    return `<div class="item${live?'':' off'}">
    <div class="row" style="align-items:center"><b style="flex:3;font-size:17px">${esc(p.t||'New promotion')}</b><span class="pill ${live?'ok':''}" style="flex:0">${live?'Live':'Not showing'}</span>
      <button class="btn ghost small" style="flex:0" onclick="CM.pMove(${i},-1)">↑</button><button class="btn ghost small" style="flex:0" onclick="CM.pMove(${i},1)">↓</button><button class="btn ghost small" style="flex:0" onclick="CM.pDel(${i})">Delete</button></div>
    <label class="chk"><input type="checkbox" ${p.active!==false?'checked':''} onchange="CM.pSet(${i},'active',this.checked)"> Show on website</label>
    <div class="grid">
      <div><label>Title</label><input value="${esc(p.t||'')}" oninput="CM.pSet(${i},'t',this.value)"></div>
      <div style="grid-column:span 2"><label>Headline (the offer in one line)</label><input value="${esc(p.h||'')}" oninput="CM.pSet(${i},'h',this.value)"></div>
      <div><label>When (e.g. Sun–Thu · 5–8 pm)</label><input value="${esc(p.when||'')}" oninput="CM.pSet(${i},'when',this.value)"></div>
      <div><label>Valid (text shown)</label><input value="${esc(p.valid||'')}" oninput="CM.pSet(${i},'valid',this.value)"></div>
      <div><label>Start showing on</label><input type="date" value="${esc(p.start||'')}" onchange="CM.pSet(${i},'start',this.value)"></div>
      <div><label>Stop showing after</label><input type="date" value="${esc(p.end||'')}" onchange="CM.pSet(${i},'end',this.value)"></div>
    </div>
    <label>Terms & details (one per line)</label><textarea rows="3" oninput="CM.pSet(${i},'tc',this.value.split('\\n').map(s=>s.trim()).filter(Boolean))">${esc((p.tc||[]).join('\n'))}</textarea>
    <div class="grid">
      <div><label>Button text</label><input value="${esc((p.cta&&p.cta[0])||'Book a table')}" oninput="CM.pCta(${i},0,this.value)"></div>
      <div><label>Button opens</label><select onchange="CM.pLink(${i},this.value)">
        <option value="#book" ${linkType==='#book'?'selected':''}>Book a table</option><option value="#menu" ${linkType==='#menu'?'selected':''}>Menu</option>
        <option value="#promos" ${linkType==='#promos'?'selected':''}>Promotions page</option><option value="WA" ${linkType==='WA'?'selected':''}>WhatsApp {{BRAND_SHORT}}</option>
        <option value="custom" ${linkType==='custom'?'selected':''}>Other link…</option></select></div>
      ${linkType==='custom'?`<div><label>Link</label><input value="${esc(link)}" oninput="CM.pCta(${i},1,this.value)"></div>`:''}
      ${linkType==='#menu'?`<div><label>Open menu at</label><select onchange="CM.pSet(${i},'cat',this.value)"><option value="">Whole menu</option>${(C.menu||[]).map(c=>`<option ${c.cat===p.cat?'selected':''}>${esc(c.cat)}</option>`).join('')}</select></div>`:''}
    </div>
    <label class="chk"><input type="checkbox" ${p.alc?'checked':''} onchange="CM.pSet(${i},'alc',this.checked)"> Alcohol offer (shows a 21+ notice)</label>
    <div class="row" style="align-items:center">${thumb(p.img||p.k)}<div style="flex:3"><button class="btn ghost small" onclick="CM.pImg(${i})">Upload poster / photo</button> <span class="muted">Square images look best.</span></div></div>
    <div class="item" style="background:{{C_DARK}}">
      <label class="chk"><input type="checkbox" ${v.enabled?'checked':''} onchange="CM.pV(${i},'enabled',this.checked)"> Members can claim a voucher for this promotion</label>
      ${v.enabled?`<div class="grid"><div><label>Voucher name</label><input value="${esc(v.title||p.t||'')}" oninput="CM.pV(${i},'title',this.value)"></div><div><label>Discount %</label><input type="number" min="0" max="100" value="${esc(v.pct||'')}" oninput="CM.pV(${i},'pct',this.value)"></div><div><label>Valid for (days after claiming)</label><input type="number" min="1" value="${esc(v.days||30)}" oninput="CM.pV(${i},'days',this.value)"></div></div><p class="muted">Each member can claim once. Staff mark it used on the member's page in the Members tab.</p>`:''}
    </div></div>`}).join('')+`<div class="bar"><button class="btn ghost" onclick="CM.pAdd()">+ Add promotion</button><button class="btn" onclick="CM.saveKey('promos','p-msg')">Save promotions</button><button class="btn ghost small" onclick="CM.undoKey('promos','p-msg')">Undo last save</button><span id="p-msg" style="flex:2"></span></div>`);
}
/* ---------------- MENU ---------------- */
function renderMenu(){
  const el=document.getElementById('t-menu');
  el.innerHTML=header('Menu','Change prices, mark items sold out, hide items, add new dishes or drinks, and upload photos. Press Save menu to publish.');
  if(needImport(el)) return;
  const M=C.menu||(C.menu=[]); if(MENU_CAT>=M.length) MENU_CAT=0; const c=M[MENU_CAT];
  el.insertAdjacentHTML('beforeend',`<div class="card">
    <div class="row"><div style="flex:3"><label>Category</label><select onchange="CM.mCat(this.value)">${M.map((x,i)=>`<option value="${i}" ${i===MENU_CAT?'selected':''}>${esc(x.group)} · ${esc(x.cat)} (${(x.items||[]).length})${x.hide?' · hidden':''}</option>`).join('')}</select></div>
      <div style="flex:2"><label>Find an item</label><input id="m-find" placeholder="Type a dish or drink name" oninput="CM.mFind(this.value)"></div>
      <div style="flex:0"><button class="btn ghost small" onclick="CM.mAddCat()">+ New category</button></div></div>
    <div id="m-found"></div></div>`+(c?`<div class="card">
    <div class="grid"><div><label>Category name</label><input value="${esc(c.cat)}" oninput="CM.mC('cat',this.value)"></div><div><label>Chinese name</label><input value="${esc(c.zh||'')}" oninput="CM.mC('zh',this.value)"></div>
      <div><label>Group</label><select onchange="CM.mC('group',this.value)"><option ${c.group==='Food'?'selected':''}>Food</option><option ${c.group==='Drinks'?'selected':''}>Drinks</option></select></div></div>
    <label>Note under the category (optional)</label><input value="${esc(c.note||'')}" oninput="CM.mC('note',this.value)">
    <div class="row" style="align-items:center"><label class="chk"><input type="checkbox" ${c.hide?'checked':''} onchange="CM.mC('hide',this.checked)"> Hide this whole category</label>
      <span style="flex:0">${thumb(c.photo)}</span><div><button class="btn ghost small" onclick="CM.mCatImg()">Category banner photo</button></div>
      <div style="flex:0"><button class="btn ghost small" onclick="CM.mMoveCat(-1)">↑</button></div><div style="flex:0"><button class="btn ghost small" onclick="CM.mMoveCat(1)">↓</button></div><div style="flex:0"><button class="btn ghost small" onclick="CM.mDelCat()">Delete category</button></div></div>
    <div class="scroll"><table><thead><tr><th>Photo</th><th>Name</th><th>Chinese</th><th>English / description</th><th>Price</th><th>Was</th><th>Tag</th><th>Sold out</th><th>Hide</th><th></th></tr></thead><tbody>
    ${(c.items||[]).map((it,j)=>`<tr id="mi-${j}" style="${it.hide?'opacity:.5':''}">
      <td style="min-width:70px">${thumb(it.photo)}<br><button class="btn ghost small" onclick="CM.mImg(${j})">Photo</button></td>
      <td style="min-width:170px"><input value="${esc(it.n||'')}" oninput="CM.mI(${j},'n',this.value)"></td>
      <td style="min-width:110px"><input value="${esc(it.zh||'')}" oninput="CM.mI(${j},'zh',this.value)"></td>
      <td style="min-width:200px"><input value="${esc(it.en||'')}" placeholder="English name" oninput="CM.mI(${j},'en',this.value)"><input style="margin-top:4px" value="${esc(it.d||'')}" placeholder="Description (optional)" oninput="CM.mI(${j},'d',this.value)"></td>
      <td style="min-width:100px"><input value="${esc(it.p||'')}" placeholder="Rp 25K" oninput="CM.mI(${j},'p',this.value)"></td>
      <td style="min-width:90px"><input value="${esc(it.was||'')}" placeholder="old price" oninput="CM.mI(${j},'was',this.value)"></td>
      <td><select onchange="CM.mI(${j},'tag',this.value)">${TAGS.map(t=>`<option ${t===(it.tag||'')?'selected':''}>${t}</option>`).join('')}</select></td>
      <td><input type="checkbox" style="width:auto" ${it.out?'checked':''} onchange="CM.mI(${j},'out',this.checked)"></td>
      <td><input type="checkbox" style="width:auto" ${it.hide?'checked':''} onchange="CM.mI(${j},'hide',this.checked)"></td>
      <td style="white-space:nowrap"><button class="btn ghost small" onclick="CM.mMove(${j},-1)">↑</button><button class="btn ghost small" onclick="CM.mMove(${j},1)">↓</button><button class="btn ghost small" onclick="CM.mDel(${j})">✕</button></td></tr>`).join('')}
    </tbody></table></div></div>`:'')+`<div class="bar"><button class="btn ghost" onclick="CM.mAdd()">+ Add item to this category</button><button class="btn" onclick="CM.saveKey('menu','m-msg')">Save menu</button><button class="btn ghost small" onclick="CM.undoKey('menu','m-msg')">Undo last save</button><span id="m-msg" style="flex:2"></span></div>`);
}
/* ---------------- SINGERS & LINE-UP ---------------- */
function renderSingers(){
  const el=document.getElementById('t-singers');
  el.innerHTML=header('Singers & weekly line-up','The line-up drives "Tonight" on the home page and the weekly schedule. Singers appear on the Tonight & Events page.');
  if(needImport(el)) return;
  const W=C.week||(C.week=DAYS.map(d=>({d,t:'',s:'',who:''}))); const S=C.singers||(C.singers=[]);
  el.insertAdjacentHTML('beforeend',`<div class="card"><h3>Weekly line-up</h3><p class="muted">Leave "Singer" empty for nights without a show. Those days are hidden from the website.</p>
    <div class="scroll"><table><thead><tr><th>Day</th><th>Show</th><th>Time</th><th>Singer</th></tr></thead><tbody>${W.map((w,i)=>`<tr><td><b>${esc(w.d)}</b></td>
    <td><input value="${esc(w.t||'')}" placeholder="Live Acoustic" oninput="CM.wSet(${i},'t',this.value)"></td><td><input value="${esc(w.s||'')}" placeholder="8–10.30 pm" oninput="CM.wSet(${i},'s',this.value)"></td>
    <td><input value="${esc(w.who||'')}" list="singer-names" oninput="CM.wSet(${i},'who',this.value)"></td></tr>`).join('')}</tbody></table></div>
    <datalist id="singer-names">${S.map(s=>`<option value="${esc(s.n)}">`).join('')}</datalist>
    <div class="bar"><button class="btn" onclick="CM.saveKey('week','w-msg')">Save line-up</button><button class="btn ghost small" onclick="CM.undoKey('week','w-msg')">Undo last save</button><span id="w-msg" style="flex:2"></span></div></div>
    <div class="card"><h3>Singers</h3>${S.map((s,i)=>`<div class="item${s.hide?' off':''}"><div class="row" style="align-items:center">${thumb(s.photo)}<b style="flex:3">${esc(s.n||'New singer')}</b>
      <button class="btn ghost small" style="flex:0" onclick="CM.sImg(${i})">Photo</button><button class="btn ghost small" style="flex:0" onclick="CM.sMove(${i},-1)">↑</button><button class="btn ghost small" style="flex:0" onclick="CM.sMove(${i},1)">↓</button><button class="btn ghost small" style="flex:0" onclick="CM.sDel(${i})">Delete</button></div>
      <div class="grid"><div><label>Name</label><input value="${esc(s.n||'')}" oninput="CM.sSet(${i},'n',this.value)"></div><div><label>Chinese name</label><input value="${esc(s.zh||'')}" oninput="CM.sSet(${i},'zh',this.value)"></div>
      <div><label>Style</label><input value="${esc(s.g||'')}" placeholder="Live acoustic" oninput="CM.sSet(${i},'g',this.value)"></div><div><label>Sings every</label><input value="${esc(s.next||'')}" placeholder="Mon" oninput="CM.sSet(${i},'next',this.value)"></div></div>
      <label>Short bio</label><input value="${esc(s.bio||'')}" oninput="CM.sSet(${i},'bio',this.value)">
      <label class="chk"><input type="checkbox" ${s.hide?'checked':''} onchange="CM.sSet(${i},'hide',this.checked)"> Hide from website</label></div>`).join('')}
    <div class="bar"><button class="btn ghost" onclick="CM.sAdd()">+ Add singer</button><button class="btn" onclick="CM.saveKey('singers','s-msg')">Save singers</button><button class="btn ghost small" onclick="CM.undoKey('singers','s-msg')">Undo last save</button><span id="s-msg" style="flex:2"></span></div></div>`);
}
/* ---------------- BANNER ---------------- */
function renderBanner(){
  const el=document.getElementById('t-banner');
  el.innerHTML=header('Top banner','A strip at the very top of every page of the website, for urgent news: "Closed tonight for a private event", "New Year countdown, book now!"');
  if(needImport(el)) return;
  const b=C.banner||(C.banner={active:false,text:'',link:'',style:'red'});
  el.insertAdjacentHTML('beforeend',`<div class="card">
    <label class="chk"><input type="checkbox" ${b.active?'checked':''} onchange="CM.bSet('active',this.checked)"> Show the banner</label>
    <label>Banner text</label><input value="${esc(b.text||'')}" maxlength="140" oninput="CM.bSet('text',this.value)" placeholder="e.g. New Year's Eve countdown, book your table now!">
    <div class="grid"><div><label>When tapped, open</label><select onchange="CM.bSet('link',this.value)">${[['','Nothing'],['#book','Book a table'],['#promos','Promotions'],['#menu','Menu'],['#tonight','Tonight & Events'],['/member.html','Member sign-up'],['WA','WhatsApp {{BRAND_SHORT}}']].map(([v,l])=>`<option value="${v}" ${v===(b.link||'')?'selected':''}>${l}</option>`).join('')}</select></div>
    <div><label>Colour</label><select onchange="CM.bSet('style',this.value)">${[['red','Brand red'],['gold','Gold'],['navy','Navy']].map(([v,l])=>`<option value="${v}" ${v===(b.style||'red')?'selected':''}>${l}</option>`).join('')}</select></div>
    <div><label>Stop showing after (optional)</label><input type="date" value="${esc(b.end||'')}" onchange="CM.bSet('end',this.value)"></div></div>
    <div class="bar"><button class="btn" onclick="CM.saveKey('banner','b-msg')">Save banner</button><button class="btn ghost small" onclick="CM.undoKey('banner','b-msg')">Undo last save</button><span id="b-msg" style="flex:2"></span></div></div>`);
}
/* ---------------- BULK VOUCHERS ---------------- */
function renderVouchers(){
  const el=document.getElementById('t-vouchers');
  el.innerHTML=`<div class="card"><h2>Send a voucher to a group of members</h2><p class="muted">The voucher appears straight away on each member's page. To give one voucher to one person, open them in the Members tab instead.</p>
  <div class="grid"><div><label>Send to</label><select id="bv-target"><option value="birthday_month">Birthdays this month</option><option value="all">All members</option><option value="promo_opt_in">Members who opted in to promos</option><option value="new_30">New members (last 30 days)</option><option value="tier_silver">Silver tier</option><option value="tier_gold">Gold tier</option><option value="tier_vip">VIP tier</option></select></div>
  <div><label>Voucher name</label><input id="bv-title" placeholder="e.g. Birthday month 15% off"></div><div><label>Discount %</label><input id="bv-pct" type="number" min="0" max="100"></div><div><label>Valid until</label><input id="bv-to" type="date" value="${addDays(30)}"></div></div>
  <label>Details (optional)</label><input id="bv-details" placeholder="e.g. Show your member QR to the cashier. Regular-price items only.">
  <div style="margin-top:10px"><button class="btn" id="bv-send">Send voucher</button></div><div id="bv-msg"></div></div>`;
  document.getElementById('bv-send').onclick=async()=>{
    const t=val('bv-title').trim(); if(!t) return msg('bv-msg','Type a voucher name.');
    const sel=document.getElementById('bv-target'); if(!window.confirm('Send "'+t+'" to: '+sel.options[sel.selectedIndex].text+'?')) return;
    document.getElementById('bv-send').disabled=true;
    const {data,error}=await sb.rpc('issue_voucher_bulk',{p_target:sel.value,p_title:t,p_details:val('bv-details'),p_pct:val('bv-pct')?+val('bv-pct'):null,p_valid_to:val('bv-to')||null});
    document.getElementById('bv-send').disabled=false;
    msg('bv-msg',error?error.message:('Sent to '+data+' member'+(data===1?'':'s')+'.'),!error);
  };
}
const R={promos:renderPromos,menu:renderMenu,singers:renderSingers,banner:renderBanner,vouchers:renderVouchers};
const rr=()=>R[CUR]();
window.CM={
  async open(tab){CUR=tab; const el=document.getElementById('t-'+tab); if(tab!=='vouchers'){el.innerHTML='<div class="card muted">Loading…</div>'; try{await load()}catch(e){el.innerHTML=`<div class="card"><div class="msg err">Could not load website content: ${esc(e.message)}</div></div>`;return}} rr();},
  saveKey:(k,m)=>save(k,m).then(ok=>{if(ok&&k!=='week')setTimeout(rr,900)}), undoKey:(k,m)=>undo(k,m,rr),
  // promos
  pSet(i,f,v){C.promos[i][f]=v; if(f==='active'||f==='start'||f==='end') rr();},
  pCta(i,n,v){const p=C.promos[i]; p.cta=p.cta||['Book a table','#book']; p.cta[n]=v;},
  pLink(i,v){const p=C.promos[i]; p.cta=p.cta||['Book a table','#book']; p.cta[1]=v==='WA'?'{{WHATSAPP_URL}}':(v==='custom'?'https://':v); if(v!=='#menu') delete p.cat; rr();},
  pV(i,f,v){const p=C.promos[i]; p.voucher=p.voucher||{enabled:false,title:'',pct:'',days:30}; p.voucher[f]=v; if(f==='enabled') rr();},
  pImg(i){pickImage(u=>{C.promos[i].img=u; rr();},'p-msg')},
  pMove(i,d){const P=C.promos,j=i+d; if(j<0||j>=P.length) return; [P[i],P[j]]=[P[j],P[i]]; rr();},
  pDel(i){if(window.confirm('Delete "'+(C.promos[i].t||'this promotion')+'"? (Press Save afterwards.)')){C.promos.splice(i,1); rr();}},
  pAdd(){const t='New promotion '+((C.promos||[]).length+1); let s=slugify(t); while((C.promos||[]).some(p=>p.slug===s)) s+='-x';
    (C.promos=C.promos||[]).unshift({k:'promo_'+s,slug:s,t,h:'',when:'',valid:'',start:todayISO(),end:'',alc:false,active:false,tc:[],cta:['Book a table','#book'],voucher:{enabled:false,title:'',pct:'',days:30}}); rr(); window.scrollTo({top:0,behavior:'smooth'});},
  // menu
  mCat(i){MENU_CAT=+i; rr();},
  mC(f,v){C.menu[MENU_CAT][f]=v; if(f==='hide'||f==='group') rr();},
  mI(j,f,v){const it=C.menu[MENU_CAT].items[j]; if(v===''||v===false) delete it[f]; else it[f]=v; if(f==='hide') rr();},
  mImg(j){pickImage(u=>{C.menu[MENU_CAT].items[j].photo=u; delete C.menu[MENU_CAT].noPhoto; rr();},'m-msg')},
  mCatImg(){pickImage(u=>{C.menu[MENU_CAT].photo=u; rr();},'m-msg')},
  mMove(j,d){const I=C.menu[MENU_CAT].items,k=j+d; if(k<0||k>=I.length) return; [I[j],I[k]]=[I[k],I[j]]; rr();},
  mDel(j){const it=C.menu[MENU_CAT].items[j]; if(window.confirm('Remove "'+it.n+'" from the menu? Tip: tick Hide instead if it may come back. (Press Save afterwards.)')){C.menu[MENU_CAT].items.splice(j,1); rr();}},
  mAdd(){C.menu[MENU_CAT].items.push({n:'New item',p:''}); rr(); setTimeout(()=>{const r=document.getElementById('mi-'+(C.menu[MENU_CAT].items.length-1)); if(r){r.scrollIntoView({block:'center'}); r.querySelector('input').select();}},50);},
  mAddCat(){const n=prompt('Name of the new category (e.g. Desserts):'); if(!n) return; const g=window.confirm('Is it a FOOD category? OK = Food, Cancel = Drinks')?'Food':'Drinks'; C.menu.push({cat:n.trim(),zh:'',group:g,items:[],noPhoto:true}); MENU_CAT=C.menu.length-1; rr();},
  mDelCat(){const c=C.menu[MENU_CAT]; if(window.confirm('Delete the whole category "'+c.cat+'" and its '+c.items.length+' items? Tip: tick "Hide this whole category" instead if it may come back.')){C.menu.splice(MENU_CAT,1); MENU_CAT=0; rr();}},
  mMoveCat(d){const M=C.menu,k=MENU_CAT+d; if(k<0||k>=M.length) return; [M[MENU_CAT],M[k]]=[M[k],M[MENU_CAT]]; MENU_CAT=k; rr();},
  mFind(q){q=q.trim().toLowerCase(); const out=document.getElementById('m-found'); if(q.length<2){out.innerHTML='';return}
    const hits=[]; C.menu.forEach((c,i)=>c.items.forEach((it,j)=>{if([it.n,it.zh,it.en].some(x=>(x||'').toLowerCase().includes(q))) hits.push([i,j,c.cat,it.n,it.p])}));
    out.innerHTML=hits.slice(0,12).map(([i,j,c,n,p])=>`<div><a href="#" onclick="CM.mGo(${i},${j});return false">${esc(n)}</a> <span class="muted">${esc(c)} · ${esc(p||'')}</span></div>`).join('')||'<span class="muted">No match.</span>';},
  mGo(i,j){MENU_CAT=i; rr(); setTimeout(()=>{const r=document.getElementById('mi-'+j); if(r){r.scrollIntoView({block:'center'}); r.style.outline='2px solid {{C_ACCENT}}';}},50);},
  // week & singers
  wSet(i,f,v){C.week[i][f]=v;},
  sSet(i,f,v){C.singers[i][f]=v; if(f==='hide') rr();},
  sImg(i){pickImage(u=>{C.singers[i].photo=u; rr();},'s-msg')},
  sMove(i,d){const S=C.singers,j=i+d; if(j<0||j>=S.length) return; [S[i],S[j]]=[S[j],S[i]]; rr();},
  sDel(i){if(window.confirm('Delete '+(C.singers[i].n||'this singer')+'? (Press Save afterwards.)')){C.singers.splice(i,1); rr();}},
  sAdd(){C.singers.push({n:'New singer',zh:'',g:'Live acoustic',next:'',bio:''}); rr();},
  // banner
  bSet(f,v){C.banner[f]=v;}
};
})();
