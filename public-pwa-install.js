(function(){
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }

  let installPrompt=null;
  let helpOverlay=null;
  const installedKey='niki-public-app-installed-v1';
  const installationIdKey='niki-public-app-installation-id-v1';
  const installationRecordedKey='niki-public-app-installation-recorded-v1';
  const section=document.getElementById('publicAppInstallSection');
  const action=document.getElementById('publicAppInstallAction');

  function readLocal(key){
    try{return localStorage.getItem(key)}catch{return null}
  }

  function writeLocal(key,value){
    try{localStorage.setItem(key,value)}catch{}
  }

  function isInstalled(){
    return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  }

  function wasInstalled(){
    return readLocal(installedKey)==='1';
  }

  function installationId(){
    let id=readLocal(installationIdKey);
    if(id)return id;
    if(crypto.randomUUID)id=crypto.randomUUID();
    else{
      const bytes=crypto.getRandomValues(new Uint8Array(16));
      bytes[6]=(bytes[6]&15)|64;
      bytes[8]=(bytes[8]&63)|128;
      const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
      id=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
    writeLocal(installationIdKey,id);
    return id;
  }

  function hideSection(){
    if(!section)return;
    section.classList.remove('visible');
    section.hidden=true;
  }

  async function rememberInstallation(){
    writeLocal(installedKey,'1');
    hideSection();
    if(readLocal(installationRecordedKey)==='1')return;
    const recorded=await window.nikiAppInstallations?.record(installationId(),'android');
    if(recorded)writeLocal(installationRecordedKey,'1');
  }

  function isAndroid(){
    return /Android/i.test(navigator.userAgent);
  }

  function isInAppBrowser(){
    return /FBAN|FBAV|Instagram|Messenger|Line\//i.test(navigator.userAgent);
  }

  function updateAction(){
    if(action)action.textContent=installPrompt?'Инсталирай':'Как?';
  }

  function revealSection(){
    if(!section||!isAndroid()||isInstalled()||wasInstalled())return;
    section.hidden=false;
    requestAnimationFrame(()=>section.classList.add('visible'));
    updateAction();
  }

  function closeHelp(){
    helpOverlay?.remove();
    helpOverlay=null;
    document.documentElement.classList.remove('publicPwaHelpOpen');
  }

  function showHelp(){
    if(helpOverlay)return;
    helpOverlay=document.createElement('div');
    helpOverlay.className='publicPwaHelpOverlay';
    helpOverlay.innerHTML=`<section class="publicPwaHelpCard" role="dialog" aria-modal="true" aria-labelledby="publicPwaHelpTitle">
      <button class="publicPwaHelpClose" type="button" aria-label="Затвори">×</button>
      <img src="assets/icons/icon-192.png" alt="">
      <h2 id="publicPwaHelpTitle">Инсталиране на Step с Niki</h2>
      ${isInAppBrowser()?'<p class="publicPwaHelpWarning">Страницата е отворена във вътрешен браузър. Първо избери <strong>Отвори в Chrome</strong>.</p>':''}
      <ol><li>Отвори сайта в <strong>Google Chrome</strong>.</li><li>Натисни менюто <strong>⋮</strong> горе вдясно.</li><li>Избери <strong>Инсталиране на приложението</strong> или <strong>Добавяне към началния екран</strong>.</li><li>Потвърди с <strong>Инсталирай</strong>.</li></ol>
      <button class="publicPwaHelpDone" type="button">Разбрах</button>
    </section>`;
    document.documentElement.classList.add('publicPwaHelpOpen');
    document.body.appendChild(helpOverlay);
    helpOverlay.querySelector('.publicPwaHelpClose').addEventListener('click',closeHelp);
    helpOverlay.querySelector('.publicPwaHelpDone').addEventListener('click',closeHelp);
    helpOverlay.addEventListener('click',event=>{if(event.target===helpOverlay)closeHelp()});
  }

  function watchTrainingDate(){
    if(!section||!isAndroid()||isInstalled()||wasInstalled())return;
    const target=document.querySelector('.featuredDateTime')||document.getElementById('featured');
    if(!target){revealSection();return}
    if(!('IntersectionObserver' in window)){revealSection();return}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        revealSection();
        observer.disconnect();
      }
    },{threshold:.2});
    observer.observe(target);
  }

  action?.addEventListener('click',async()=>{
    if(!installPrompt){showHelp();return}
    installPrompt.prompt();
    const choice=await installPrompt.userChoice;
    if(choice.outcome==='accepted')await rememberInstallation();
    installPrompt=null;
    updateAction();
  });

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installPrompt=event;
    updateAction();
  });
  window.addEventListener('appinstalled',()=>{
    installPrompt=null;
    closeHelp();
    rememberInstallation();
  });
  window.addEventListener('load',()=>{
    if(isInstalled()||wasInstalled())rememberInstallation();
    else setTimeout(watchTrainingDate,350);
  });
})();
