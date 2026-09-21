let approvedAlertFilter='all';
let approvedUtilityTab='overview';
window.uaRouteMode='driving';

function openSettings(){document.getElementById('settingsSheet')?.classList.add('open')}
function closeSettings(){document.getElementById('settingsSheet')?.classList.remove('open')}
window.openSettings=openSettings;window.closeSettings=closeSettings;

async function searchMapLocation(){
  const input=document.getElementById('mapSearchInput');
  const q=input?.value?.trim(); if(!q)return;
  input.disabled=true;
  try{
    const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q),{headers:{'Accept-Language':currentLang||'uk'}});
    const data=await r.json();
    if(!data?.length)throw new Error('not-found');
    const hit=data[0];
    map.setView([Number(hit.lat),Number(hit.lon)],13,{animate:true});
    if(window.refreshDynamicLayers)refreshDynamicLayers(true);
  }catch(e){alert(currentLang==='uk'?'Місце не знайдено.':currentLang==='ru'?'Место не найдено.':'Location not found.')}
  finally{input.disabled=false}
}
window.searchMapLocation=searchMapLocation;

function setTravelMode(mode,btn){
  window.uaRouteMode=mode;
  document.querySelectorAll('[data-route-mode],.sheet-modes button').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('[data-route-mode="'+mode+'"]').forEach(x=>x.classList.add('active'));
  document.querySelectorAll('.sheet-modes button').forEach(x=>{
    const txt=x.textContent||'';
    if((mode==='driving'&&txt.includes('🚗'))||(mode==='walking'&&txt.includes('🚶'))||(mode==='cycling'&&txt.includes('🚲')))x.classList.add('active');
  });
  if(btn)btn.classList.add('active');
}
window.setTravelMode=setTravelMode;

function switchPreparedTab(tab,btn){
  document.querySelectorAll('.prepared-panel').forEach(x=>x.classList.remove('active'));
  document.getElementById('prepared-'+tab)?.classList.add('active');
  document.querySelectorAll('.prepared-tabs button').forEach(x=>x.classList.remove('active'));
  btn?.classList.add('active');
}
window.switchPreparedTab=switchPreparedTab;

function switchUtilityTab(tab,btn){
  approvedUtilityTab=tab;
  document.querySelectorAll('.utility-tabs button').forEach(x=>x.classList.remove('active'));
  btn?.classList.add('active');
  refreshUtilityPanel(true);
}
window.switchUtilityTab=switchUtilityTab;

function setAlertFilter(filter,btn){
  approvedAlertFilter=filter;
  document.querySelectorAll('#alertFilters button').forEach(x=>x.classList.remove('active'));
  btn?.classList.add('active');
  refreshApprovedAlerts(true);
}
window.setAlertFilter=setAlertFilter;

function timeAgo(iso){
  const d=Date.now()-new Date(iso||Date.now()).getTime();
  const m=Math.max(0,Math.round(d/60000));
  if(m<1)return 'now'; if(m<60)return m+' min';
  const h=Math.round(m/60); if(h<24)return h+' h';
  return Math.round(h/24)+' d';
}
function approvedEsc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function alertVisual(type){
  if(type==='power'||type==='water'||type==='heating')return ['yellow',type==='power'?'⚡':type==='water'?'💧':'♨'];
  if(type==='shelter')return ['green','⌂'];
  if(type==='medical')return ['blue','✚'];
  if(type==='road')return ['yellow','🚧'];
  if(type==='fire')return ['red','🔥'];
  return ['red','!'];
}
function userDistance(item){
  try{
    const p=nativeLoc(); if(!p||!item?.lat||!item?.lng)return null;
    return distanceKm(p.lat,p.lng,Number(item.lat),Number(item.lng));
  }catch(e){return null}
}

async function refreshApprovedAlerts(force=false){
  const list=document.getElementById('approvedAlertList'); if(!list)return;
  if(force)list.innerHTML='<div class="loading-card">Refreshing safety information…</div>';
  let officialCount=0;
  try{officialCount=(airAlertsSnapshot?.raions?.length||0)+(airAlertsSnapshot?.oblasts?.length||0)}catch(e){}
  const banner=document.getElementById('approvedEmergencyBanner');
  if(banner){
    if(officialCount>0){
      banner.innerHTML='<div class="emergency-symbol">!</div><div class="grow"><b>'+officialCount+' active official air-alert area'+(officialCount===1?'':'s')+'</b><p>Open the map for official alert zones. Follow local authorities immediately.</p></div><span class="pulse-dot"></span>';
    }else{
      banner.innerHTML='<div class="emergency-symbol">✓</div><div class="grow"><b>Official alert layer connected</b><p>Open the map for the latest official alert zones and risk overlays.</p></div>';
    }
  }

  let rows=[];
  try{
    if(realtime&&sb){
      const since=new Date(Date.now()-24*3600e3).toISOString();
      const {data}=await sb.from('community_alerts').select('*').gte('created_at',since).order('created_at',{ascending:false}).limit(40);
      rows=data||[];
    }else{
      rows=JSON.parse(localStorage.getItem('alerts')||'[]').slice().reverse();
    }
  }catch(e){rows=[]}

  if(approvedAlertFilter==='nearby')rows=rows.filter(x=>{const d=userDistance(x);return d!==null&&d<30});
  if(approvedAlertFilter==='official'){
    list.innerHTML=officialCount
      ? '<div class="alert-row"><div class="alert-icon red">!</div><div class="alert-copy"><b>Official air-alert zones</b><small>'+officialCount+' active area'+(officialCount===1?'':'s')+' · NEPTUN data layer</small></div><div class="alert-meta"><span>LIVE</span><span class="verify-tag">Official layer</span></div></div>'
      : '<div class="loading-card">No active official air-alert areas are shown by the connected feed right now.</div>';
    return;
  }

  if(!rows.length){
    list.innerHTML='<div class="loading-card">No recent community safety reports in this view. Official alert zones remain available on the map.</div>';
    return;
  }
  list.innerHTML=rows.slice(0,16).map(a=>{
    const [cls,ico]=alertVisual(a.type);
    const d=userDistance(a);
    const verified=(a.confirmations||0)>=3&&(a.confirmations||0)>(a.rejections||0);
    return '<div class="alert-row">'+
      '<div class="alert-icon '+cls+'">'+ico+'</div>'+
      '<div class="alert-copy"><b>'+approvedEsc(typeLabel(a.type))+'</b><small>'+approvedEsc(a.text||'Civilian safety report')+(d!==null?' · '+d.toFixed(1)+' km':'')+'</small></div>'+
      '<div class="alert-meta"><span>'+timeAgo(a.created_at)+'</span><span class="verify-tag">'+(verified?'Community verified':'Unverified')+'</span></div>'+
    '</div>';
  }).join('');
}
window.refreshApprovedAlerts=refreshApprovedAlerts;

async function refreshShelterPanel(force=false){
  const box=document.getElementById('approvedShelterList');if(!box)return;
  const p=nativeLoc();
  const origin=document.getElementById('routeOriginLabel');
  if(!p){
    if(origin)origin.textContent='Location permission required';
    box.innerHTML='<div class="loading-card">Enable location access, then tap refresh to find real shelters near you.</div>';
    document.getElementById('shelterCount').textContent='—';
    return;
  }
  if(origin)origin.textContent=p.lat.toFixed(4)+', '+p.lng.toFixed(4);
  if(force)box.innerHTML='<div class="loading-card">Finding nearby shelters…</div>';
  try{
    const radius=cfg.routeShelterSearchMeters||20000;
    const q='[out:json][timeout:20];(nwr(around:'+radius+','+p.lat+','+p.lng+')[amenity=shelter][shelter_type=bomb_shelter];);out center tags;';
    const r=await fetch(cfg.overpassUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)});
    if(!r.ok)throw new Error('overpass');
    const j=await r.json();
    const rows=(j.elements||[]).map(e=>{
      const lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon;
      if(!lat||!lng)return null;
      return {lat,lng,name:e.tags?.['name:uk']||e.tags?.name||'Civilian shelter',d:distanceKm(p.lat,p.lng,lat,lng)};
    }).filter(Boolean).sort((a,b)=>a.d-b.d).slice(0,10);
    document.getElementById('shelterCount').textContent=rows.length?rows.length+' nearby':'0 nearby';
    if(!rows.length){box.innerHTML='<div class="loading-card">No mapped bomb shelters found within the current search radius. Check local official sources.</div>';return}
    box.innerHTML=rows.map((s,i)=>
      '<div class="shelter-row"><div class="shelter-mark">⌂</div><div><b>'+approvedEsc(s.name)+'</b><small>'+s.d.toFixed(1)+' km · OpenStreetMap · verify availability on arrival</small></div><button onclick="routeShelterFromPanel('+s.lat+','+s.lng+',\''+approvedEsc(s.name).replace(/'/g,"&#039;")+'\')">Route</button></div>'
    ).join('');
  }catch(e){box.innerHTML='<div class="loading-card">Shelter service is temporarily unavailable. Open the map and follow local official shelter guidance.</div>'}
}
window.refreshShelterPanel=refreshShelterPanel;
function routeShelterFromPanel(lat,lng,name){
  page('map',document.getElementById('navMap'));
  setTimeout(()=>buildSaferRoute({lat:Number(lat),lng:Number(lng)},name),180);
}
window.routeShelterFromPanel=routeShelterFromPanel;

async function refreshUtilityPanel(force=false){
  const box=document.getElementById('approvedUtilityList');if(!box)return;
  if(force)box.innerHTML='<div class="loading-card">Refreshing infrastructure reports…</div>';
  const stamp=document.getElementById('utilityLastUpdate');
  if(stamp)stamp.textContent='Updated '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  let rows=[];
  try{
    if(realtime&&sb){
      let q=sb.from('utility_incidents').select('*').eq('status','active').order('created_at',{ascending:false}).limit(40);
      if(approvedUtilityTab!=='overview')q=q.eq('service',approvedUtilityTab);
      const {data}=await q;rows=data||[];
    }
  }catch(e){rows=[]}
  if(!rows.length){
    const cities=['Kyiv','Kharkiv','Dnipro','Odesa','Lviv'];
    box.innerHTML=cities.map(city=>'<div class="utility-row"><div class="utility-icon">⌁</div><div><b>'+city+'</b><small>No active incident data in the connected feed</small></div><span class="utility-status good">No report</span></div>').join('');
    return;
  }
  box.innerHTML=rows.slice(0,18).map(x=>{
    const ico=x.service==='power'?'⚡':x.service==='water'?'💧':'♨';
    const sev=(x.severity||x.level||'').toString().toLowerCase();
    const cls=sev.includes('critical')||sev==='3'?'bad':sev.includes('partial')||sev==='2'?'warn':'';
    return '<div class="utility-row"><div class="utility-icon">'+ico+'</div><div><b>'+approvedEsc(x.title||typeLabel(x.service)||'Infrastructure incident')+'</b><small>'+approvedEsc(x.details||x.source_name||'Connected utility feed')+'</small></div><span class="utility-status '+cls+'">'+approvedEsc(x.service||'status')+'</span></div>';
  }).join('');
}
window.refreshUtilityPanel=refreshUtilityPanel;

const originalPage=window.page;
window.page=function(n,b){
  originalPage(n,b);
  if(n==='alerts')setTimeout(()=>refreshApprovedAlerts(),20);
  if(n==='shelters')setTimeout(()=>refreshShelterPanel(),20);
  if(n==='utilities')setTimeout(()=>refreshUtilityPanel(),20);
};

setTimeout(()=>{
  const nav=document.getElementById('navMap');
  if(nav && !document.getElementById('authGate')?.classList.contains('hidden')) return;
  if(nav)window.page('map',nav);
},700);

setInterval(()=>{
  if(document.getElementById('p-alerts')?.classList.contains('active'))refreshApprovedAlerts();
  if(document.getElementById('p-utilities')?.classList.contains('active'))refreshUtilityPanel();
},45000);
