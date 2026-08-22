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
    const platform=installationPlatform();
    if(!platform)return;
    const recorded=await window.nikiAppInstallations?.record(installationId(),platform);
    if(recorded)writeLocal(installationRecordedKey,'1');
  }

  function isAndroid(){
    return /Android/i.test(navigator.userAgent);
  }

  function isIOS(){
    return /iPad|iPhone|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  }

  function isChromeIOS(){
    return isIOS()&&/CriOS/i.test(navigator.userAgent);
  }

  function installationPlatform(){
    if(isIOS())return 'ios';
    if(isAndroid())return 'android';
    return '';
  }

  function isSupportedPhone(){
    return isAndroid()||isIOS();
  }

  function isInAppBrowser(){
    return /FBAN|FBAV|Instagram|Messenger|Line\//i.test(navigator.userAgent);
  }

  function updateAction(){
    if(action)action.textContent=installPrompt&&!isIOS()?'Инсталирай':'Как?';
  }

  function revealSection(){
    if(!section||!isSupportedPhone()||isInstalled()||wasInstalled())return;
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
    const ios=isIOS();
    const iosBrowser=isChromeIOS()?'Google Chrome':'Safari или браузъра, който използваш';
    const steps=ios
      ? `<p class="publicPwaHelpWarning">Инсталиране през <strong>${iosBrowser}</strong></p><ol><li>Натисни бутона <strong>Споделяне</strong> — квадратчето със стрелка нагоре.</li><li>Намери и избери <strong>Добавяне към Начален екран</strong>.</li><li>Потвърди с <strong>Добавяне</strong> горе вдясно.</li><li>Отвори <strong>Step с Niki</strong> от новата икона на телефона.</li>${isChromeIOS()?'<li>Ако опцията липсва, обнови iOS или отвори страницата в Safari.</li>':''}</ol>`
      : `<ol><li>Отвори сайта в <strong>Google Chrome</strong>.</li><li>Натисни менюто <strong>⋮</strong> горе вдясно.</li><li>Избери <strong>Инсталиране на приложението</strong> или <strong>Добавяне към началния екран</strong>.</li><li>Потвърди с <strong>Инсталирай</strong>.</li></ol>`;
    helpOverlay=document.createElement('div');
    helpOverlay.className='publicPwaHelpOverlay';
    helpOverlay.innerHTML=`<section class="publicPwaHelpCard" role="dialog" aria-modal="true" aria-labelledby="publicPwaHelpTitle">
      <button class="publicPwaHelpClose" type="button" aria-label="Затвори">×</button>
      <img src="assets/icons/icon-192.png" alt="">
      <h2 id="publicPwaHelpTitle">Инсталиране на Step с Niki</h2>
      ${isInAppBrowser()?'<p class="publicPwaHelpWarning">Страницата е отворена във вътрешен браузър. Първо избери <strong>Отвори в Safari</strong> или <strong>Отвори в Chrome</strong>.</p>':''}
      ${steps}
      <button class="publicPwaHelpDone" type="button">Разбрах</button>
    </section>`;
    document.documentElement.classList.add('publicPwaHelpOpen');
    document.body.appendChild(helpOverlay);
    helpOverlay.querySelector('.publicPwaHelpClose').addEventListener('click',closeHelp);
    helpOverlay.querySelector('.publicPwaHelpDone').addEventListener('click',closeHelp);
    helpOverlay.addEventListener('click',event=>{if(event.target===helpOverlay)closeHelp()});
  }

  function watchTrainingDate(){
    if(!section||!isSupportedPhone()||isInstalled()||wasInstalled())return;
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
