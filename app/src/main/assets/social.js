Object.assign(I18N.uk,{
  addStory:'＋ Story',feedTitle:'Стрічка спільноти',feedHint:'Свайп вправо — вподобати, вліво — далі.',newPost:'＋ Допис',
  navFeed:'Стрічка',navProfile:'Профіль',editable:'Редагується',addKitItem:'Додати пункт',username:'Ім’я користувача',
  save:'Зберегти',logout:'Вийти',caption:'Підпис...',choosePhotoVideo:'Обрати фото або відео',authLogin:'Вхід',
  authRegister:'Реєстрація',authCreate:'Створити акаунт',authHave:'Вже є акаунт? Увійти',authNoAccount:'Створити акаунт',
  authSignIn:'Увійти',authSignUp:'Зареєструватися',uploading:'Завантаження…',published:'Опубліковано',
  noPosts:'Поки немає дописів. Створіть перший.',emailConfirm:'Перевірте email для підтвердження акаунта.',
  passwordShort:'Пароль має містити щонайменше 6 символів.',mediaRequired:'Оберіть фото або відео.',delete:'Видалити'
});
Object.assign(I18N.ru,{
  addStory:'＋ Story',feedTitle:'Лента сообщества',feedHint:'Свайп вправо — лайк, влево — дальше.',newPost:'＋ Пост',
  navFeed:'Лента',navProfile:'Профиль',editable:'Редактируется',addKitItem:'Добавить пункт',username:'Имя пользователя',
  save:'Сохранить',logout:'Выйти',caption:'Подпись...',choosePhotoVideo:'Выбрать фото или видео',authLogin:'Вход',
  authRegister:'Регистрация',authCreate:'Создать аккаунт',authHave:'Уже есть аккаунт? Войти',authNoAccount:'Создать аккаунт',
  authSignIn:'Войти',authSignUp:'Зарегистрироваться',uploading:'Загрузка…',published:'Опубликовано',
  noPosts:'Пока нет публикаций. Создайте первую.',emailConfirm:'Проверьте email для подтверждения аккаунта.',
  passwordShort:'Пароль должен содержать минимум 6 символов.',mediaRequired:'Выберите фото или видео.',delete:'Удалить'
});
Object.assign(I18N.en,{
  addStory:'＋ Story',feedTitle:'Community feed',feedHint:'Swipe right to like, left to skip.',newPost:'＋ Post',
  navFeed:'Feed',navProfile:'Profile',editable:'Editable',addKitItem:'Add item',username:'Username',
  save:'Save',logout:'Log out',caption:'Caption...',choosePhotoVideo:'Choose photo or video',authLogin:'Sign in',
  authRegister:'Create account',authCreate:'Create account',authHave:'Already have an account? Sign in',authNoAccount:'Create account',
  authSignIn:'Sign in',authSignUp:'Sign up',uploading:'Uploading…',published:'Published',
  noPosts:'No posts yet. Create the first one.',emailConfirm:'Check your email to confirm the account.',
  passwordShort:'Password must be at least 6 characters.',mediaRequired:'Choose a photo or video.',delete:'Delete'
});

let authMode='login';
let currentUser=null;
let currentProfile=null;
let socialRealtimeChannel=null;
let nearbyChannel=null;
let checklistRows=[];

window.startAuthFlow=async function(){
  if(!sb) sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  sb.auth.onAuthStateChange((event,session)=>{
    try{
      if(session?.access_token&&window.Android?.setAuthToken) Android.setAuthToken(session.access_token);
      if(!session&&window.Android?.clearAuthToken) Android.clearAuthToken();
    }catch(e){}
  });
  const {data:{session}}=await sb.auth.getSession();
  if(session) await afterAuthenticated(session);
  else showAuth();
};

function showAuth(){
  document.getElementById('authGate').classList.remove('hidden');
  document.getElementById('authMessage').textContent='';
  applyAuthMode();
}
function hideAuth(){document.getElementById('authGate').classList.add('hidden')}

function toggleAuthMode(){authMode=authMode==='login'?'register':'login';applyAuthMode()}
function applyAuthMode(){
  const registering=authMode==='register';
  const title=document.getElementById('authTitle');
  const submit=document.getElementById('authSubmit');
  const sw=document.getElementById('authSwitch');
  const user=document.getElementById('authUsername');
  title.textContent=t(registering?'authRegister':'authLogin');
  submit.textContent=t(registering?'authSignUp':'authSignIn');
  sw.textContent=t(registering?'authHave':'authNoAccount');
  user.classList.toggle('hidden',!registering);
}

async function submitAuth(){
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  const username=document.getElementById('authUsername').value.trim();
  const msg=document.getElementById('authMessage');
  msg.textContent='';
  if(!email){msg.textContent='Email';return}
  if(password.length<6){msg.textContent=t('passwordShort');return}
  document.getElementById('authSubmit').disabled=true;
  try{
    if(authMode==='register'){
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{username},emailRedirectTo:cfg.authRedirectUrl}});
      if(error) throw error;
      if(data.session){
        if(username) await sb.from('profiles').update({username}).eq('id',data.user.id);
        await afterAuthenticated(data.session);
      }else{
        msg.textContent=t('emailConfirm');
        authMode='login';applyAuthMode();
      }
    }else{
      const {data,error}=await sb.auth.signInWithPassword({email,password});
      if(error) throw error;
      await afterAuthenticated(data.session);
    }
  }catch(e){msg.textContent=e?.message||String(e)}
  finally{document.getElementById('authSubmit').disabled=false}
}

async function afterAuthenticated(session){
  currentUser=session.user;
  try{if(window.Android?.setAuthToken)Android.setAuthToken(session.access_token)}catch(e){}
  hideAuth();
  await initBackend();
  await ensureProfile();
  await Promise.allSettled([loadFeed(),loadStories(),loadChecklist()]);
  subscribeSocialRealtime();
  subscribeNearbyNotifications();
  updateProfileUI();
  if(window.initSafetyMap)window.initSafetyMap();
  page('feed',document.getElementById('navFeed'));
}

async function ensureProfile(){
  let {data}=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();
  if(!data){
    const name=(currentUser.email||'user').split('@')[0].slice(0,32);
    await sb.from('profiles').insert({id:currentUser.id,username:name});
    const result=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();
    data=result.data;
  }
  currentProfile=data||{id:currentUser.id,username:(currentUser.email||'user').split('@')[0]};
}
function updateProfileUI(){
  const name=currentProfile?.username||t('user');
  document.getElementById('profileUsername').textContent=name;
  document.getElementById('profileEmail').textContent=currentUser?.email||'';
  document.getElementById('profileUsernameInput').value=name;
  document.getElementById('profileAvatar').textContent=(name[0]||'U').toUpperCase();
}
async function saveProfile(){
  const username=document.getElementById('profileUsernameInput').value.trim().slice(0,32);
  if(!username)return;
  const {error}=await sb.from('profiles').update({username,updated_at:new Date().toISOString()}).eq('id',currentUser.id);
  if(error){alert(error.message);return}
  currentProfile.username=username;updateProfileUI();await Promise.all([loadFeed(),loadStories()]);
}
async function logout(){
  await sb.auth.signOut();
  currentUser=null;currentProfile=null;realtime=false;
  try{if(window.Android?.clearAuthToken)Android.clearAuthToken()}catch(e){}
  showAuth();
}

function openPostSheet(){document.getElementById('postSheet').classList.add('open')}
function closePostSheet(){document.getElementById('postSheet').classList.remove('open')}
function openStorySheet(){document.getElementById('storySheet').classList.add('open')}
function closeStorySheet(){document.getElementById('storySheet').classList.remove('open')}

async function uploadSocial(file,folder){
  if(!file)throw new Error(t('mediaRequired'));
  const safe=(file.name||'media').replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=currentUser.id+'/'+folder+'/'+Date.now()+'-'+safe;
  const {error}=await sb.storage.from('social').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
  if(error)throw error;
  return sb.storage.from('social').getPublicUrl(path).data.publicUrl;
}
async function createPost(){
  const file=document.getElementById('postMedia').files[0];
  const status=document.getElementById('postUploadStatus');
  if(!file){status.textContent=t('mediaRequired');return}
  status.textContent=t('uploading');
  try{
    const url=await uploadSocial(file,'posts');
    const mediaType=file.type.startsWith('video/')?'video':'image';
    const caption=document.getElementById('postCaption').value.trim();
    const {error}=await sb.from('posts').insert({user_id:currentUser.id,caption,media_url:url,media_type:mediaType});
    if(error)throw error;
    status.textContent=t('published');
    document.getElementById('postCaption').value='';document.getElementById('postMedia').value='';
    closePostSheet();await loadFeed();
  }catch(e){status.textContent=e?.message||String(e)}
}
async function createStory(){
  const file=document.getElementById('storyMedia').files[0];
  const status=document.getElementById('storyUploadStatus');
  if(!file){status.textContent=t('mediaRequired');return}
  status.textContent=t('uploading');
  try{
    const url=await uploadSocial(file,'stories');
    const mediaType=file.type.startsWith('video/')?'video':'image';
    const {error}=await sb.from('stories').insert({user_id:currentUser.id,media_url:url,media_type:mediaType});
    if(error)throw error;
    status.textContent=t('published');document.getElementById('storyMedia').value='';
    closeStorySheet();await loadStories();
  }catch(e){status.textContent=e?.message||String(e)}
}

async function loadFeed(){
  if(!currentUser)return;
  const deck=document.getElementById('feedDeck');
  const {data,error}=await sb.from('posts').select('id,user_id,caption,media_url,media_type,created_at,profiles(username,avatar_url)').order('created_at',{ascending:false}).limit(60);
  if(error){deck.innerHTML='<div class="empty-state">'+esc(error.message)+'</div>';return}
  const posts=data||[];
  if(!posts.length){deck.innerHTML='<div class="empty-state">'+t('noPosts')+'</div>';return}
  const ids=posts.map(p=>p.id);
  const {data:likes}=await sb.from('post_likes').select('post_id,user_id').in('post_id',ids);
  const counts={},mine=new Set();
  (likes||[]).forEach(l=>{counts[l.post_id]=(counts[l.post_id]||0)+1;if(l.user_id===currentUser.id)mine.add(l.post_id)});
  deck.innerHTML=posts.map(p=>postHtml(p,counts[p.id]||0,mine.has(p.id))).join('');
  deck.querySelectorAll('.post-card').forEach(bindSwipeCard);
}
function postHtml(p,count,liked){
  const name=p.profiles?.username||t('user');
  const media=p.media_type==='video'
    ?'<video class="post-media" src="'+esc(p.media_url)+'" controls playsinline preload="metadata"></video>'
    :'<img class="post-media" src="'+esc(p.media_url)+'" loading="lazy">';
  return '<article class="post-card" data-post="'+p.id+'" data-liked="'+(liked?'1':'0')+'">'+
    '<div class="post-head"><div class="mini-avatar">'+esc((name[0]||'U').toUpperCase())+'</div><div><b>'+esc(name)+'</b><div class="meta">'+new Date(p.created_at).toLocaleString()+'</div></div></div>'+
    media+
    '<div class="post-buttons"><button class="heart '+(liked?'liked':'')+'" onclick="toggleLike(\''+p.id+'\',this)">♥</button><span id="likes-'+p.id+'">'+count+'</span><button class="skip-btn" onclick="skipCard(this.closest(\'.post-card\'))">→</button></div>'+
    (p.caption?'<div class="caption"><b>'+esc(name)+'</b> '+esc(p.caption)+'</div>':'')+
  '</article>';
}
async function toggleLike(postId,btn){
  const card=btn?.closest('.post-card')||document.querySelector('[data-post="'+postId+'"]');
  const liked=card?.dataset.liked==='1';
  if(liked){
    await sb.from('post_likes').delete().eq('post_id',postId).eq('user_id',currentUser.id);
  }else{
    await sb.from('post_likes').upsert({post_id:postId,user_id:currentUser.id});
  }
  card.dataset.liked=liked?'0':'1';
  if(btn)btn.classList.toggle('liked',!liked);
  const countEl=document.getElementById('likes-'+postId);
  if(countEl)countEl.textContent=Math.max(0,Number(countEl.textContent)+(liked?-1:1));
}
function bindSwipeCard(card){
  let x0=0,y0=0,dx=0;
  card.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY;dx=0},{passive:true});
  card.addEventListener('touchmove',e=>{
    dx=e.touches[0].clientX-x0;
    const dy=e.touches[0].clientY-y0;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>8)card.style.transform='translateX('+dx+'px) rotate('+(dx/30)+'deg)';
  },{passive:true});
  card.addEventListener('touchend',async()=>{
    card.style.transition='transform .22s ease,opacity .22s ease';
    if(Math.abs(dx)>90){
      if(dx>0&&card.dataset.liked!=='1')await toggleLike(card.dataset.post,card.querySelector('.heart'));
      card.style.transform='translateX('+(dx>0?500:-500)+'px) rotate('+(dx>0?14:-14)+'deg)';
      card.style.opacity='0';setTimeout(()=>card.remove(),230);
    }else card.style.transform='';
    setTimeout(()=>{card.style.transition=''},250);
  });
}
function skipCard(card){if(!card)return;card.style.transition='transform .22s ease,opacity .22s ease';card.style.transform='translateX(-500px) rotate(-12deg)';card.style.opacity='0';setTimeout(()=>card.remove(),230)}

async function loadStories(){
  if(!currentUser)return;
  const {data,error}=await sb.from('stories').select('id,user_id,media_url,media_type,created_at,expires_at,profiles(username,avatar_url)').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:true}).limit(80);
  const box=document.getElementById('stories');if(error){box.innerHTML='';return}
  box.innerHTML=(data||[]).map(s=>{
    const name=s.profiles?.username||t('user');
    const thumb=s.media_type==='image'?'<img src="'+esc(s.media_url)+'">':'<div class="story-video-thumb">▶</div>';
    return '<button class="story-bubble" onclick="openStoryViewer(\''+s.id+'\')"><div class="story-ring">'+thumb+'</div><span>'+esc(name)+'</span></button>';
  }).join('');
  window.__stories=data||[];
}
function openStoryViewer(id){
  const s=(window.__stories||[]).find(x=>x.id===id);if(!s)return;
  const name=s.profiles?.username||t('user');
  document.getElementById('storyContent').innerHTML='<div class="story-name">'+esc(name)+'</div>'+
    (s.media_type==='video'?'<video src="'+esc(s.media_url)+'" autoplay controls playsinline></video>':'<img src="'+esc(s.media_url)+'">');
  document.getElementById('storyViewer').classList.remove('hidden');
}
function closeStoryViewer(){document.getElementById('storyViewer').classList.add('hidden');document.getElementById('storyContent').innerHTML=''}

async function loadChecklist(){
  if(!currentUser)return;
  let {data,error}=await sb.from('user_checklist_items').select('*').eq('user_id',currentUser.id).order('sort_order');
  if(error)return;
  if(!data?.length){
    const defaults=(t('kit')||[]).map((title,i)=>({user_id:currentUser.id,title,sort_order:i}));
    if(defaults.length)await sb.from('user_checklist_items').insert(defaults);
    const r=await sb.from('user_checklist_items').select('*').eq('user_id',currentUser.id).order('sort_order');data=r.data||[];
  }
  checklistRows=data||[];renderEditableKit();
}
function renderEditableKit(){
  const box=document.getElementById('kit');if(!box)return;
  if(!currentUser){box.innerHTML='';return}
  box.innerHTML=checklistRows.map(row=>
    '<div class="check edit-check"><input type="checkbox" '+(row.checked?'checked':'')+' onchange="setChecklistChecked(\''+row.id+'\',this.checked)">'+
    '<input class="check-title" value="'+esc(row.title)+'" onchange="renameChecklistItem(\''+row.id+'\',this.value)">'+
    '<button class="trash-btn" onclick="deleteChecklistItem(\''+row.id+'\')">×</button></div>'
  ).join('');
}
window.renderKit=renderEditableKit;
async function setChecklistChecked(id,checked){await sb.from('user_checklist_items').update({checked,updated_at:new Date().toISOString()}).eq('id',id);const r=checklistRows.find(x=>x.id===id);if(r)r.checked=checked}
async function renameChecklistItem(id,title){title=title.trim();if(!title)return;await sb.from('user_checklist_items').update({title,updated_at:new Date().toISOString()}).eq('id',id);const r=checklistRows.find(x=>x.id===id);if(r)r.title=title}
async function addChecklistItem(){
  const input=document.getElementById('newKitItem'),title=input.value.trim();if(!title||!currentUser)return;
  const sort=checklistRows.length?Math.max(...checklistRows.map(x=>x.sort_order||0))+1:0;
  const {data,error}=await sb.from('user_checklist_items').insert({user_id:currentUser.id,title,sort_order:sort}).select().single();
  if(!error&&data){checklistRows.push(data);input.value='';renderEditableKit()}
}
async function deleteChecklistItem(id){await sb.from('user_checklist_items').delete().eq('id',id);checklistRows=checklistRows.filter(x=>x.id!==id);renderEditableKit()}

function subscribeSocialRealtime(){
  if(socialRealtimeChannel)sb.removeChannel(socialRealtimeChannel);
  socialRealtimeChannel=sb.channel('social-feed-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>loadFeed())
    .on('postgres_changes',{event:'*',schema:'public',table:'stories'},()=>loadStories())
    .on('postgres_changes',{event:'*',schema:'public',table:'post_likes'},()=>loadFeed())
    .subscribe();
}
function subscribeNearbyNotifications(){
  if(nearbyChannel)sb.removeChannel(nearbyChannel);
  nearbyChannel=sb.channel('nearby-alert-notify')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'community_alerts'},p=>maybeNotifyNearby(p.new))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'utility_incidents'},p=>maybeNotifyNearby(p.new))
    .subscribe();
}
function distanceKm(lat1,lon1,lat2,lon2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function maybeNotifyNearby(item){
  const p=nativeLoc();if(!p||!item?.lat||!item?.lng)return;
  const d=distanceKm(p.lat,p.lng,Number(item.lat),Number(item.lng));
  const radius=cfg.nearbyAlertRadiusKm||20;if(d>radius)return;
  const type=item.type||item.service||'danger';
  const title=typeLabel(type);
  const body=(item.text||item.title||t('utilityIncident'))+' · '+d.toFixed(1)+' km';
  try{if(window.Android?.notifyNearbyAlert)Android.notifyNearbyAlert(title,body)}catch(e){}
}

async function handleAuthDeepLink(url){
  try{
    if(!sb) sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    const parsed=new URL(url);
    const hash=new URLSearchParams((parsed.hash||'').replace(/^#/,''));
    const query=parsed.searchParams;
    const access=hash.get('access_token')||query.get('access_token');
    const refresh=hash.get('refresh_token')||query.get('refresh_token');
    const code=query.get('code');
    if(code){
      const {data,error}=await sb.auth.exchangeCodeForSession(code);
      if(error)throw error;
      if(data?.session)await afterAuthenticated(data.session);
      return;
    }
    if(access&&refresh){
      const {data,error}=await sb.auth.setSession({access_token:access,refresh_token:refresh});
      if(error)throw error;
      if(data?.session)await afterAuthenticated(data.session);
      return;
    }
    const {data:{session}}=await sb.auth.getSession();
    if(session)await afterAuthenticated(session);
  }catch(e){
    const msg=document.getElementById('authMessage');
    if(msg)msg.textContent=e?.message||String(e);
    showAuth();
  }
}
window.handleAuthDeepLink=handleAuthDeepLink;

window.openPostSheet=openPostSheet;
window.closePostSheet=closePostSheet;
window.openStorySheet=openStorySheet;
window.closeStorySheet=closeStorySheet;
window.openStoryViewer=openStoryViewer;
window.closeStoryViewer=closeStoryViewer;
window.submitAuth=submitAuth;
window.toggleAuthMode=toggleAuthMode;
window.createPost=createPost;
window.createStory=createStory;
window.toggleLike=toggleLike;
window.skipCard=skipCard;
window.saveProfile=saveProfile;
window.logout=logout;
window.addChecklistItem=addChecklistItem;
window.setChecklistChecked=setChecklistChecked;
window.renameChecklistItem=renameChecklistItem;
window.deleteChecklistItem=deleteChecklistItem;

setLanguage(currentLang);
