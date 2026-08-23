(function(){
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }

  let installPrompt=null;
  let installBanner=null;
  let helpOverlay=null;

  function isInstalled(){
    return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
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

  function isSupportedPhone(){
    return isAndroid()||isIOS();
  }

  function isInAppBrowser(){
    return /FBAN|FBAV|Instagram|Messenger|Line\//i.test(navigator.userAgent);
  }

  function removeBanner(){
    installBanner?.remove();
    installBanner=null;
  }

  function closeHelp(){
    helpOverlay?.remove();
    helpOverlay=null;
    document.documentElement.classList.remove('adminPwaHelpOpen');
  }

  function showInstallHelp(){
    if(helpOverlay)return;
    const ios=isIOS();
    const iosBrowser=isChromeIOS()?'Google Chrome':'Safari или браузъра, който използваш';
    const steps=ios
      ? `<p class="adminPwaHelpWarning">Инсталиране през <strong>${iosBrowser}</strong></p><ol><li>Натисни бутона <strong>Споделяне</strong> — квадратчето със стрелка нагоре.</li><li>Намери и избери <strong>Добавяне към Начален екран</strong>.</li><li>Потвърди с <strong>Добавяне</strong> горе вдясно.</li><li>Отвори <strong>Niki Admin</strong> от новата икона на телефона.</li>${isChromeIOS()?'<li>Ако опцията липсва, обнови iOS или отвори админ панела в Safari.</li>':''}</ol>`
      : `<ol><li>Отвори админ панела в <strong>Google Chrome</strong>.</li><li>Натисни менюто <strong>⋮</strong> горе вдясно.</li><li>Избери <strong>Инсталиране на приложението</strong> или <strong>Добавяне към началния екран</strong>.</li><li>Потвърди с <strong>Инсталирай</strong>.</li></ol>`;
    helpOverlay=document.createElement('div');
    helpOverlay.className='adminPwaHelpOverlay';
    helpOverlay.innerHTML=`<section class="adminPwaHelpCard" role="dialog" aria-modal="true" aria-labelledby="adminPwaHelpTitle">
      <button class="adminPwaHelpClose" type="button" aria-label="Затвори">×</button>
      <img src="assets/admin-icons/admin-icon-192.png" alt="">
      <h2 id="adminPwaHelpTitle">Инсталиране на Niki Admin</h2>
      ${isInAppBrowser()?'<p class="adminPwaHelpWarning">Страницата е отворена във вътрешен браузър. Първо избери <strong>Отвори в Safari</strong> или <strong>Отвори в Chrome</strong>.</p>':''}
      ${steps}
      <button class="adminPwaHelpDone" type="button">Разбрах</button>
    </section>`;
    document.documentElement.classList.add('adminPwaHelpOpen');
    document.body.appendChild(helpOverlay);
    helpOverlay.querySelector('.adminPwaHelpClose').addEventListener('click',closeHelp);
    helpOverlay.querySelector('.adminPwaHelpDone').addEventListener('click',closeHelp);
    helpOverlay.addEventListener('click',event=>{if(event.target===helpOverlay)closeHelp()});
  }

  function updateBanner(){
    if(!installBanner)return;
    installBanner.querySelector('small').textContent=installPrompt&&!isIOS()?'Добави админ приложението':`${isIOS()?'iOS':'Android'} · админ приложение`;
    installBanner.querySelector('.adminPwaInstallAction').textContent=installPrompt&&!isIOS()?'Инсталирай':'Как?';
  }

  function showInstallBanner(){
    if(isInstalled()||(!installPrompt&&!isSupportedPhone()))return;
    if(installBanner){updateBanner();return}
    installBanner=document.createElement('aside');
    installBanner.className='adminPwaInstallBanner';
    installBanner.setAttribute('aria-label','Инсталиране на админ приложението');
    installBanner.innerHTML=`<img src="assets/admin-icons/admin-icon-192.png" alt=""><span><strong>Niki Admin</strong><small>${isIOS()?'iOS':'Android'} · админ приложение</small></span><button class="adminPwaInstallAction" type="button">Как?</button><button class="adminPwaInstallClose" type="button" aria-label="Затвори">×</button>`;

    if(!document.getElementById('adminPwaInstallStyles')){
      const style=document.createElement('style');
      style.id='adminPwaInstallStyles';
      style.textContent='.adminPwaInstallBanner{position:fixed;z-index:1200;left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));display:grid;grid-template-columns:42px minmax(0,1fr) auto 28px;align-items:center;gap:9px;max-width:520px;margin:0 auto;padding:8px 8px 8px 9px;border:1px solid rgba(255,255,255,.2);border-radius:15px;background:rgba(21,32,43,.97);box-shadow:0 10px 35px rgba(0,0,0,.32);color:#fff;font-family:Inter,system-ui,sans-serif;backdrop-filter:blur(12px)}.adminPwaInstallBanner img{width:42px;height:42px;border-radius:11px;object-fit:cover}.adminPwaInstallBanner span{min-width:0}.adminPwaInstallBanner strong,.adminPwaInstallBanner small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adminPwaInstallBanner strong{font-size:13px}.adminPwaInstallBanner small{margin-top:2px;color:#bfcbd5;font-size:10px;font-weight:700}.adminPwaInstallAction{min-height:34px;border:0;border-radius:9px;padding:6px 10px;background:#57c982;color:#0a2717;font-size:11px;font-weight:950}.adminPwaInstallClose{width:28px;height:28px;border:0;background:transparent;color:#cbd0d4;font-size:22px;line-height:1}.adminPwaHelpOpen,.adminPwaHelpOpen body{overflow:hidden}.adminPwaHelpOverlay{position:fixed;z-index:1300;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,7,10,.72);font-family:Inter,system-ui,sans-serif}.adminPwaHelpCard{position:relative;width:min(100%,390px);max-height:calc(100dvh - 36px);overflow:auto;border-radius:20px;background:#fff;padding:23px 20px 20px;color:#182028;box-shadow:0 18px 55px rgba(0,0,0,.35)}.adminPwaHelpCard>img{display:block;width:64px;height:64px;margin:0 auto 10px;border-radius:16px;object-fit:cover}.adminPwaHelpCard h2{margin:0 0 14px;text-align:center;font-size:20px}.adminPwaHelpCard ol{margin:0;padding-left:24px}.adminPwaHelpCard li{margin:0 0 11px;padding-left:3px;font-size:14px;line-height:1.45}.adminPwaHelpWarning{margin:0 0 14px;padding:10px 11px;border-radius:10px;background:#fff1d7;color:#77520b;font-size:13px;line-height:1.4}.adminPwaHelpClose{position:absolute;right:10px;top:8px;width:34px;height:34px;border:0;background:transparent;color:#697078;font-size:26px}.adminPwaHelpDone{width:100%;min-height:44px;margin-top:5px;border:0;border-radius:11px;background:#176f50;color:#fff;font-size:14px;font-weight:950}@media(max-width:390px){.adminPwaInstallBanner{grid-template-columns:38px minmax(0,1fr) auto 24px;gap:7px}.adminPwaInstallBanner img{width:38px;height:38px}.adminPwaInstallAction{padding:5px 8px}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(installBanner);
    updateBanner();

    installBanner.querySelector('.adminPwaInstallAction').addEventListener('click',async()=>{
      if(!installPrompt||isIOS()){showInstallHelp();return}
      installPrompt.prompt();
      const choice=await installPrompt.userChoice;
      if(choice.outcome==='accepted')removeBanner();
      installPrompt=null;
      updateBanner();
    });
    installBanner.querySelector('.adminPwaInstallClose').addEventListener('click',removeBanner);
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installPrompt=event;
    showInstallBanner();
  });
  window.addEventListener('appinstalled',()=>{
    installPrompt=null;
    closeHelp();
    removeBanner();
  });
  window.addEventListener('load',()=>setTimeout(showInstallBanner,900));
})();
