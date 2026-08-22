(function(){
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }

  let installPrompt=null;
  let helpOverlay=null;
  const section=document.getElementById('publicAppInstallSection');
  const action=document.getElementById('publicAppInstallAction');

  function isInstalled(){
    return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
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
    if(!section||!isAndroid()||isInstalled())return;
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
    if(!section||!isAndroid()||isInstalled())return;
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
    if(choice.outcome==='accepted')section.hidden=true;
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
    if(section)section.hidden=true;
  });
  window.addEventListener('load',()=>setTimeout(watchTrainingDate,350));
})();
