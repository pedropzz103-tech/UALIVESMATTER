let approvedAlertFilter='all';
let approvedUtilityTab='overview';
window.uaRouteMode='walking';

let routePreviewMap=null;
let routePreviewLayers=null;

function openSettings(){document.getElementById('settingsSheet')?.classList.add('open')}
function closeSettings(){document.getElementById('settingsSheet')?.classList.remove('open')}
window.openSettings=openSettings;
window.closeSettings=closeSettings;

async function searchMapLocation(){
  const input=document.getElementById('mapSearchInput');
  const q=input?.value?.trim();
  if(!q)return;
  input.disabled=true;
  try{
    const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q),{
      headers:{'Accept-Language':currentLang||'en'}
    });
    const data=await r.json();
    if(!data?.length)throw new Error('not-found');
    map.setView([Number(data[0].lat),Number(data[0].lon)],13,{animate:true});
    refreshDynamicLayers(true);
  }catch(e){
    alert(currentLang==='uk'?'Місце не знайдено.':currentLang==='ru'?'Место не найдено.':'Location not found.');
  }finally{input.disabled=false}
}
window.searchMapLocation=searchMapLocation;

function syncApprovedNav(pageName){
  const third=document.getElementById('navThird');
  const label=document.getElementById('navThirdLabel');
  const icon=document.getElementById('navThirdIcon');
  if(!third||!label||!icon)return;
  if(pageName==='utilities'){
    label.textContent='Utilities';
    icon.textContent='⌁';
    third.onclick=()=>{page('utilities',third);refreshUtilityPanel()};
  }else{
    label.textContent='Shelters';
    icon.textContent='⌂';
    third.onclick=()=>{page('shelters',third);refreshShelterPanel()};
  }
}
window.syncApprovedNav=syncApprovedNav;

function setTravelMode(mode,btn){
  window.uaRouteMode=mode;
  document.querySelectorAll('[data-route-mode]').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('[data-route-mode="'+mode+'"]').forEach(x=>x.classList.add('active'));
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

function approvedEsc(s=''){
  return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function timeAgo(iso){
  const ms=Date.now()-new Date(iso||Date.now()).getTime();
  const m=Math.max(0,Math.round(ms/60000));
  if(m<1)return 'now';
  if(m<60)return m+' min ago';
  const h=Math.round(m/60);
  if(h<24)return h+' h ago';
  return Math.round(h/24)+' d ago';
}
function userDistance(item){
  try{
    const p=nativeLoc();
    if(!p||!item?.lat||!item?.lng)return null;
    return distanceKm(p.lat,p.lng,Number(item.lat),Number(item.lng));
  }catch(e){return null}
}
function alertVisual(type){
  if(type==='power'||type==='water'||type==='heating')return ['yellow',type==='power'?'⚡':type==='water'?'💧':'♨'];
  if(type==='shelter')return ['green','⌂'];
  if(type==='medical')return ['blue','✚'];
  if(type==='road')return ['yellow','△'];
  if(type==='fire')return ['red','🔥'];
  return ['red','✦'];
}

async function refreshApprovedAlerts(force=false){
  const list=document.getElementById('approvedAlertList');
  if(!list)return;
  if(force)list.innerHTML='<div class="loading-card">Refreshing safety information…</div>';

  let officialCount=0;
  try{officialCount=(airAlertsSnapshot?.raions?.length||0)+(airAlertsSnapshot?.oblasts?.length||0)}catch(e){}
  const banner=document.getElementById('approvedEmergencyBanner');
  if(banner){
    if(officialCount>0){
      banner.innerHTML='<div class="air-alert-icon">♟</div><div class="grow"><b>Air raid alert</b><small>'+officialCount+' active official area'+(officialCount===1?'':'s')+'</small><p>Go to a shelter immediately.<br>Follow official instructions.</p></div><span class="alert-time">LIVE</span>';
    }else{
      banner.innerHTML='<div class="air-alert-icon">♟</div><div class="grow"><b>Official alert layer connected</b><small>Ukraine</small><p>No active official air-alert area is shown in the connected feed right now.</p></div><span class="alert-time">LIVE</span>';
    }
  }

  if(approvedAlertFilter==='official'){
    list.innerHTML=officialCount
      ?'<div class="alert-row"><div class="alert-icon red">♟</div><div class="alert-copy"><b>Official air-alert zones</b><small>'+officialCount+' active area'+(officialCount===1?'':'s')+' · NEPTUN layer</small></div><div class="alert-meta"><span>LIVE</span><span class="verify-tag">Official</span></div></div>'
      :'<div class="loading-card">No active official alert area is shown by the connected feed.</div>';
    return;
  }

  let rows=[];
  try{
    if(realtime&&sb){
      const since=new Date(Date.now()-24*3600e3).toISOString();
      const {data}=await sb.from('community_alerts')
        .select('*')
        .gte('created_at',since)
        .order('created_at',{ascending:false})
        .limit(50);
      rows=data||[];
    }else{
      rows=JSON.parse(localStorage.getItem('alerts')||'[]').slice().reverse();
    }
  }catch(e){rows=[]}

  if(approvedAlertFilter==='nearby'){
    rows=rows.filter(x=>{
      const d=userDistance(x);
      return d!==null&&d<=30;
    });
  }

  if(!rows.length){
    list.innerHTML=
      '<div class="alert-row"><div class="alert-icon blue">i</div><div class="alert-copy"><b>No recent community reports</b><small>Official alert zones remain available on the map</small></div><div class="alert-meta"><span>now</span><span class="verify-tag">Info</span></div></div>';
    return;
  }

  list.innerHTML=rows.slice(0,12).map(a=>{
    const [cls,ico]=alertVisual(a.type);
    const d=userDistance(a);
    const verified=(a.confirmations||0)>=3&&(a.confirmations||0)>(a.rejections||0);
    return '<div class="alert-row">'+
      '<div class="alert-icon '+cls+'">'+ico+'</div>'+
      '<div class="alert-copy"><b>'+approvedEsc(typeLabel(a.type))+'</b><small>'+approvedEsc(a.text||'Civilian safety report')+(d!==null?' · '+d.toFixed(1)+' km':'')+'</small></div>'+
      '<div class="alert-meta"><span>'+timeAgo(a.created_at)+'</span><span class="verify-tag">'+(verified?'Verified':'Unverified')+'</span></div>'+
    '</div>';
  }).join('');
}
window.refreshApprovedAlerts=refreshApprovedAlerts;

async function refreshShelterPanel(force=false){
  const box=document.getElementById('approvedShelterList');
  if(!box)return;
  const p=nativeLoc();
  const origin=document.getElementById('routeOriginLabel');
  if(!p){
    if(origin)origin.textContent='Location permission required';
    document.getElementById('shelterCount').textContent='—';
    box.innerHTML='<div class="loading-card">Enable location access to load nearby mapped shelters.</div>';
    return;
  }
  if(origin)origin.textContent=p.lat.toFixed(4)+', '+p.lng.toFixed(4);
  if(force)box.innerHTML='<div class="loading-card">Finding nearby shelters…</div>';
  try{
    const radius=cfg.routeShelterSearchMeters||20000;
    const q='[out:json][timeout:20];(nwr(around:'+radius+','+p.lat+','+p.lng+')[amenity=shelter][shelter_type=bomb_shelter];);out center tags;';
    const r=await fetch(cfg.overpassUrl,{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:'data='+encodeURIComponent(q)
    });
    if(!r.ok)throw new Error('overpass');
    const j=await r.json();
    const rows=(j.elements||[]).map(e=>{
      const lat=e.lat??e.center?.lat;
      const lng=e.lon??e.center?.lon;
      if(!lat||!lng)return null;
      return {
        lat,lng,
        name:e.tags?.['name:uk']||e.tags?.name||'Civilian shelter',
        d:distanceKm(p.lat,p.lng,lat,lng)
      };
    }).filter(Boolean).sort((a,b)=>a.d-b.d).slice(0,8);

    document.getElementById('shelterCount').textContent=rows.length?rows.length+' nearby':'0 nearby';
    if(!rows.length){
      box.innerHTML='<div class="loading-card">No mapped bomb shelter found inside the current search radius. Follow local official guidance.</div>';
      return;
    }
    box.innerHTML=rows.map(s=>
      '<div class="shelter-row">'+
        '<div class="shelter-mark">⌂</div>'+
        '<div><b>'+approvedEsc(s.name)+'</b><small>'+s.d.toFixed(1)+' km · verify availability on arrival</small></div>'+
        '<button onclick="routeShelterFromPanel('+s.lat+','+s.lng+',\''+approvedEsc(s.name).replace(/'/g,"&#039;")+'\')">Route</button>'+
      '</div>'
    ).join('');
  }catch(e){
    box.innerHTML='<div class="loading-card">Shelter data is temporarily unavailable.</div>';
  }
}
window.refreshShelterPanel=refreshShelterPanel;

function routeShelterFromPanel(lat,lng,name){
  buildSaferRoute({lat:Number(lat),lng:Number(lng)},name);
}
window.routeShelterFromPanel=routeShelterFromPanel;

async function refreshUtilityPanel(force=false){
  const box=document.getElementById('approvedUtilityList');
  if(!box)return;
  const stamp=document.getElementById('utilityLastUpdate');
  if(stamp)stamp.textContent='Today, '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  let rows=[];
  try{
    if(realtime&&sb){
      let q=sb.from('utility_incidents').select('*').eq('status','active').order('created_at',{ascending:false}).limit(30);
      if(approvedUtilityTab!=='overview')q=q.eq('service',approvedUtilityTab);
      const {data}=await q;
      rows=data||[];
    }
  }catch(e){rows=[]}

  if(!rows.length){
    const defaults=[
      ['yellow','⚠','Kyiv','Partial outages'],
      ['red','✕','Kharkiv','Significant outages'],
      ['green','⌂','Odesa','Stable'],
      ['blue','✕','Dnipro','Planned maintenance'],
      ['green','⌂','Lviv','Stable']
    ];
    box.innerHTML=defaults.map(x=>
      '<div class="utility-row"><div class="utility-icon '+x[0]+'">'+x[1]+'</div><div><b>'+x[2]+'</b><small>'+x[3]+'</small></div><span>›</span></div>'
    ).join('');
    return;
  }
  box.innerHTML=rows.slice(0,12).map(x=>{
    const service=x.service||'status';
    const icon=service==='power'?'⚡':service==='water'?'💧':'♨';
    const color=service==='power'?'yellow':service==='water'?'blue':'red';
    return '<div class="utility-row"><div class="utility-icon '+color+'">'+icon+'</div><div><b>'+approvedEsc(x.title||typeLabel(service))+'</b><small>'+approvedEsc(x.details||x.source_name||'Active infrastructure report')+'</small></div><span>›</span></div>';
  }).join('');
}
window.refreshUtilityPanel=refreshUtilityPanel;

function ensureRoutePreview(){
  if(routePreviewMap)return routePreviewMap;
  const el=document.getElementById('routePreviewMap');
  if(!el||typeof L==='undefined')return null;
  routePreviewMap=L.map(el,{
    zoomControl:false,
    attributionControl:false,
    preferCanvas:true,
    dragging:true,
    tap:false
  }).setView([50.45,30.52],12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(routePreviewMap);
  routePreviewLayers=L.layerGroup().addTo(routePreviewMap);
  return routePreviewMap;
}
window.ensureRoutePreview=ensureRoutePreview;

function presentApprovedRoute(route,start,dest,meta={}){
  const third=document.getElementById('navThird');
  page('shelters',third);
  syncApprovedNav('shelters');
  setTimeout(()=>{
    const rm=ensureRoutePreview();
    if(!rm)return;
    rm.invalidateSize();
    routePreviewLayers.clearLayers();
    const line=L.geoJSON(route.geometry,{style:{color:'#087cff',weight:7,opacity:.96,lineCap:'round'}}).addTo(routePreviewLayers);
    L.circleMarker([start.lat,start.lng],{radius:8,color:'#fff',weight:3,fillColor:'#1682ff',fillOpacity:1}).addTo(routePreviewLayers);
    L.circleMarker([dest.lat,dest.lng],{radius:9,color:'#fff',weight:3,fillColor:'#2db46d',fillOpacity:1}).addTo(routePreviewLayers);
    if(line.getBounds().isValid())rm.fitBounds(line.getBounds(),{padding:[24,24]});
    const d=document.getElementById('routeDestinationLabel');
    if(d)d.textContent=meta.sourceLabel||'Selected safe place';
    const metrics=document.getElementById('inlineRouteMetrics');
    if(metrics)metrics.innerHTML='<span><b>'+approvedEsc(meta.km||'—')+'</b><small>km</small></span><span><b>'+approvedEsc(meta.min||'—')+'</b><small>min</small></span>';
    const rec=document.querySelector('#inlineRouteRecommendation .grow small');
    if(rec)rec.textContent=(meta.riskText?meta.riskText+' risk':'Safety-scored route')+(meta.note?' · '+meta.note:'');
  },80);
}
window.presentApprovedRoute=presentApprovedRoute;

function clearApprovedRoute(){
  routePreviewLayers?.clearLayers();
  const metrics=document.getElementById('inlineRouteMetrics');
  if(metrics)metrics.innerHTML='<span><b>—</b><small>km</small></span><span><b>—</b><small>min</small></span>';
  const d=document.getElementById('routeDestinationLabel');
  if(d)d.textContent='Nearest available shelter';
}
window.clearApprovedRoute=clearApprovedRoute;

const originalPage=window.page;
window.page=function(name,button){
  originalPage(name,button);
  syncApprovedNav(name);
  document.querySelector('.nav')?.classList.toggle('route-hidden',name==='shelters');
  if(name==='map'){
    setTimeout(()=>map.invalidateSize({pan:false}),20);
  }else if(name==='alerts'){
    setTimeout(()=>refreshApprovedAlerts(),20);
  }else if(name==='shelters'){
    setTimeout(()=>{
      ensureRoutePreview()?.invalidateSize();
      refreshShelterPanel();
    },20);
  }else if(name==='utilities'){
    setTimeout(()=>refreshUtilityPanel(),20);
  }
};

setInterval(()=>{
  if(document.getElementById('p-alerts')?.classList.contains('active'))refreshApprovedAlerts();
  if(document.getElementById('p-utilities')?.classList.contains('active'))refreshUtilityPanel();
},45000);
