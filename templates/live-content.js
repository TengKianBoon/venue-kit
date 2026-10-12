/* forward Google sign-in results that land on the home page to the right page */
(function(){ try{ var h=location.hash||'', q=location.search||'';
  if(/access_token=|error_description=/.test(h) || /[?&](code|error_description)=/.test(q)){
    var ret='/member.html'; try{ ret=localStorage.getItem('{{SLUG}}_return')||ret; }catch(e){}
    if(!/^\/(member|admin)\.html$/.test(ret)) ret='/member.html';
    location.replace(ret+q+h); } }catch(e){} })();
/* {{DOMAIN}}: load menu, singers, line-up, promotions and banner live from the {{BRAND_SHORT}} admin (Supabase table site_content).
   If anything fails, the content built into the page stays as it is. */
(function(){
  var URL_='{{SUPABASE_URL}}/rest/v1/site_content?select=key,data';
  var KEY='{{SUPABASE_KEY}}'; // public key, read-only access to published content
  function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function reg(v){ if(v && /^https?:/.test(v)) PHOTOS[v]=v; }
  function swap(arr,next){ arr.splice.apply(arr,[0,arr.length].concat(next)); }
  function q(s){return document.querySelector(s);}
  function run(C){
    var t=today(), changed=false;
    try{ if(Array.isArray(C.menu) && C.menu.length && typeof renderMenu==='function'){
      var M=C.menu.filter(function(c){return !c.hide;}).map(function(c){var x=JSON.parse(JSON.stringify(c)); x.items=(x.items||[]).filter(function(i){return !i.hide;}); reg(x.photo); x.items.forEach(function(i){reg(i.photo);}); return x;}).filter(function(c){return c.items.length;});
      if(M.length){ swap(MENU,M); renderMenu(); changed=true; } } }catch(e){console.warn('menu',e);}
    try{ if(Array.isArray(C.singers) && C.singers.length && typeof singerCard==='function'){
      var S=C.singers.filter(function(s){return !s.hide && s.n;}); S.forEach(function(s){reg(s.photo);});
      if(S.length){ swap(SINGERS,S); var a=q('.singer2'), b=q('.singer4'); if(a) a.innerHTML=SINGERS.slice(0,2).map(singerCard).join(''); if(b) b.innerHTML=SINGERS.map(singerCard).join(''); changed=true; } } }catch(e){console.warn('singers',e);}
    try{ if(Array.isArray(C.week) && C.week.length===7){
      swap(WEEK,C.week); var ok=function(w){return w && w.who && !/\[/.test(w.who);};
      var w=WEEK[todayIdx], who=q('.tn-who'), what=q('.tn-what');
      if(who&&what){ if(ok(w)){ who.textContent=w.who; what.textContent=[w.t,w.s].filter(Boolean).join(' · '); } else { who.textContent='Live music tonight'; what.textContent="See this week's line-up"; } }
      var g=q('.weekgrid'); if(g) g.innerHTML=WEEK.map(function(w,i){return {w:w,i:i};}).filter(function(x){return ok(x.w);}).map(function(x){var now=x.i===todayIdx;return '<a class="card day'+(now?' now':'')+'" href="#tonight" style="text-decoration:none"><small>'+x.w.d.toUpperCase()+(now?' · TONIGHT':'')+'</small><span class="t">'+esc(x.w.who)+'</span><span class="s">'+esc(x.w.t||'')+' · '+esc(x.w.s||'')+'</span></a>';}).join('');
      var l=q('.lulist'); if(l) l.innerHTML=WEEK.map(function(w,i){return {w:w,i:i};}).filter(function(x){return ok(x.w);}).map(function(x){var now=x.i===todayIdx;return '<div class="lu'+(now?' now':'')+'"><span class="when">'+x.w.d.toUpperCase()+(now?' · TONIGHT':'')+'</span><span class="what">'+esc(x.w.t||'')+(x.w.s?' · '+esc(x.w.s):'')+'</span><span class="who">'+esc(x.w.who)+'</span><a class="btn '+(now?'btn-red':'btn-line')+' btn-sm" href="#book" data-day="'+x.i+'">Book</a></div>';}).join('');
      changed=true; } }catch(e){console.warn('week',e);}
    try{ if(Array.isArray(C.promos)){
      var P=C.promos.filter(function(p){return p.active!==false && (!p.start||p.start<=t) && (!p.end||p.end>=t) && p.t;}).map(function(p){
        var x=JSON.parse(JSON.stringify(p)); x.k=x.k||('promo_'+(x.slug||Math.random().toString(36).slice(2)));
        if(x.img){ PHOTOS[x.k]=x.img; } x.tc=x.tc||[]; x.cta=x.cta||['Book a table','#book']; x.when=x.when||''; x.valid=x.valid||''; x.h=x.h||''; return x;});
      swap(PROMOS,P);
      var strip=q('.promostrip'), grid=q('.promogrid');
      var card=function(p){return '<a class="card promo'+(p.alc?' alc':'')+'" href="#promos" style="text-decoration:none;color:inherit"><div class="pwrap">'+pimg(p)+gate(p)+'</div><div style="padding:16px"><b style="font-size:17px">'+esc(p.t)+'</b><div style="font-size:13px;color:var(--mute);margin-top:4px">'+esc(p.when)+'</div></div></a>';};
      var full=function(p){return '<div class="card promo'+(p.alc?' alc':'')+'" id="promo-'+esc(p.slug||p.k.slice(6))+'"><div class="pwrap">'+pimg(p)+gate(p)+'</div><div style="padding:22px;display:flex;flex-direction:column;gap:10px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><h3 class="disp" style="font-size:24px">'+esc(p.t)+'</h3>'+(p.alc?'<span class="tierpill">21+</span>':'')+'</div><b style="color:var(--gold2)">'+esc(p.h)+'</b><span style="color:var(--mute);font-size:14px">'+esc([p.when,p.valid].filter(Boolean).join(' · '))+'</span>'+(p.tc.length?'<details><summary style="cursor:pointer;font-weight:700">Details and terms</summary><ul style="margin:10px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px;color:var(--soft);font-size:14px;line-height:1.45">'+p.tc.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></details>':'')+(p.voucher&&p.voucher.enabled?'<a class="btn btn-line" href="/member.html#claim-'+esc(p.slug)+'" style="margin-top:6px">Members: claim your voucher</a>':'')+'<a class="btn '+(p.alc?'btn-line':'btn-red')+'" href="'+esc(p.cta[1]||'#book')+'"'+(p.cat?' data-cat="'+esc(p.cat)+'"':'')+(/^https?:/.test(p.cta[1]||'')?' target="_blank" rel="noopener"':'')+' style="margin-top:6px">'+esc(p.cta[0]||'Book a table')+'</a></div></div>';};
      if(strip) strip.innerHTML=PROMOS.map(card).join('') || '<p style="color:var(--mute)">New promotions coming soon.</p>';
      if(grid) grid.innerHTML=PROMOS.map(full).join('') || '<p style="color:var(--mute)">New promotions coming soon. Follow us on Instagram {{INSTAGRAM}}.</p>';
      changed=true; } }catch(e){console.warn('promos',e);}
    try{ var b=C.banner; if(b && b.active && b.text && (!b.end || b.end>=t)){
      var colors={red:['{{C_HIGHLIGHT}}','#fff'],gold:['{{C_ACCENT}}','{{C_DARK}}'],navy:['{{C_DARK}}','{{C_LIGHT}}']}[b.style||'red']||['{{C_HIGHLIGHT}}','#fff'];
      var link=b.link==='WA'?WA:(b.link||''); var el=document.createElement(link?'a':'div');
      el.id='{{SLUG}}-banner'; el.textContent=b.text; if(link){ el.href=link; if(/^https?:/.test(link)){el.target='_blank';el.rel='noopener';} }
      el.style.cssText='display:block;text-align:center;padding:10px 16px;font:700 14px/1.4 "Plus Jakarta Sans",sans-serif;text-decoration:none;position:relative;z-index:60;background:'+colors[0]+';color:'+colors[1];
      var old=document.getElementById('{{SLUG}}-banner'); if(old) old.remove(); document.body.insertBefore(el,document.body.firstChild); } }catch(e){console.warn('banner',e);}
    if(changed){ try{ applyPhotos(); }catch(e){} try{ if(typeof setLang==='function' && typeof LANG!=='undefined' && LANG!=='en') setLang(LANG); }catch(e){} }
  }
  fetch(URL_,{headers:{apikey:KEY,Authorization:'Bearer '+KEY}}).then(function(r){return r.ok?r.json():[];}).then(function(rows){
    var C={}; (rows||[]).forEach(function(r){C[r.key]=r.data;}); if(Object.keys(C).length) run(C);
  }).catch(function(e){console.warn('live content unavailable',e);});
})();
