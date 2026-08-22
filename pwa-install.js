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
    document.documentElement.classList.remove('pwaHelpOpen');
  }

  function showAndroidHelp(){
    if(helpOverlay)return;
    helpOverlay=document.createElement('div');
    helpOverlay.className='pwaHelpOverlay';
    helpOverlay.innerHTML=`<section class="pwaHelpCard" role="dialog" aria-modal="true" aria-labelledby="pwaHelpTitle">
      <button class="pwaHelpClose" type="button" aria-label="Затвори">×</button>
      <img src="assets/icons/icon-192.png" alt="">
      <h2 id="pwaHelpTitle">Инсталиране на Android</h2>
      ${isInAppBrowser()?'<p class="pwaHelpWarning">Страницата е отворена във вътрешен браузър. Първо избери <strong>Отвори в Chrome</strong>.</p>':''}
      <ol><li>Отвори сайта в <strong>Google Chrome</strong>.</li><li>Натисни менюто <strong>⋮</strong> горе вдясно.</li><li>Избери <strong>Инсталиране на приложението</strong> или <strong>Добавяне към началния екран</strong>.</li><li>Потвърди с <strong>Инсталирай</strong>.</li></ol>
      <button class="pwaHelpDone" type="button">Разбрах</button>
    </section>`;
    document.documentElement.classList.add('pwaHelpOpen');
    document.body.appendChild(helpOverlay);
    helpOverlay.querySelector('.pwaHelpClose').addEventListener('click',closeHelp);
    helpOverlay.querySelector('.pwaHelpDone').addEventListener('click',closeHelp);
    helpOverlay.addEventListener('click',event=>{if(event.target===helpOverlay)closeHelp()});
  }

  function updateBanner(){
    if(!installBanner)return;
    installBanner.querySelector('small').textContent=installPrompt?'Добави като приложение':'Android · инсталиране';
    installBanner.querySelector('.pwaInstallAction').textContent=installPrompt?'Инсталирай':'Как?';
  }

  function showInstallBanner(){
    if(isInstalled()||(!installPrompt&&!isAndroid()))return;
    if(installBanner){updateBanner();return}
    installBanner=document.createElement('aside');
    installBanner.className='pwaInstallBanner';
    installBanner.setAttribute('aria-label','Инсталиране на приложението');
    installBanner.innerHTML='<img src="assets/icons/icon-192.png" alt=""><span><strong>Step с Niki</strong><small>Android · инсталиране</small></span><button class="pwaInstallAction" type="button">Как?</button><button class="pwaInstallClose" type="button" aria-label="Затвори">×</button>';

    if(!document.getElementById('pwaInstallStyles')){
      const style=document.createElement('style');
      style.id='pwaInstallStyles';
      style.textContent='.pwaInstallBanner{position:fixed;z-index:1200;left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));display:grid;grid-template-columns:42px minmax(0,1fr) auto 28px;align-items:center;gap:9px;max-width:520px;margin:0 auto;padding:8px 8px 8px 9px;border:1px solid rgba(255,255,255,.18);border-radius:15px;background:rgba(20,22,27,.96);box-shadow:0 10px 35px rgba(0,0,0,.32);color:#fff;font-family:Inter,system-ui,sans-serif;backdrop-filter:blur(12px)}.pwaInstallBanner img{width:42px;height:42px;border-radius:11px;object-fit:cover}.pwaInstallBanner span{min-width:0}.pwaInstallBanner strong,.pwaInstallBanner small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pwaInstallBanner strong{font-size:13px}.pwaInstallBanner small{margin-top:2px;color:#bfc5ca;font-size:10px;font-weight:700}.pwaInstallAction{min-height:34px;border:0;border-radius:9px;padding:6px 10px;background:#57c982;color:#0a2717;font-size:11px;font-weight:950}.pwaInstallClose{width:28px;height:28px;border:0;background:transparent;color:#cbd0d4;font-size:22px;line-height:1}.pwaHelpOpen,.pwaHelpOpen body{overflow:hidden}.pwaHelpOverlay{position:fixed;z-index:1300;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,7,10,.72);font-family:Inter,system-ui,sans-serif}.pwaHelpCard{position:relative;width:min(100%,390px);max-height:calc(100dvh - 36px);overflow:auto;border-radius:20px;background:#fff;padding:23px 20px 20px;color:#182028;box-shadow:0 18px 55px rgba(0,0,0,.35)}.pwaHelpCard>img{display:block;width:64px;height:64px;margin:0 auto 10px;border-radius:16px;object-fit:cover}.pwaHelpCard h2{margin:0 0 14px;text-align:center;font-size:20px}.pwaHelpCard ol{margin:0;padding-left:24px}.pwaHelpCard li{margin:0 0 11px;padding-left:3px;font-size:14px;line-height:1.45}.pwaHelpWarning{margin:0 0 14px;padding:10px 11px;border-radius:10px;background:#fff1d7;color:#77520b;font-size:13px;line-height:1.4}.pwaHelpClose{position:absolute;right:10px;top:8px;width:34px;height:34px;border:0;background:transparent;color:#697078;font-size:26px}.pwaHelpDone{width:100%;min-height:44px;margin-top:5px;border:0;border-radius:11px;background:#176f50;color:#fff;font-size:14px;font-weight:950}@media(max-width:390px){.pwaInstallBanner{grid-template-columns:38px minmax(0,1fr) auto 24px;gap:7px}.pwaInstallBanner img{width:38px;height:38px}.pwaInstallAction{padding:5px 8px}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(installBanner);
    updateBanner();

    installBanner.querySelector('.pwaInstallAction').addEventListener('click',async()=>{
      if(!installPrompt){showAndroidHelp();return}
      installPrompt.prompt();
      const choice=await installPrompt.userChoice;
      if(choice.outcome==='accepted')removeBanner();
      installPrompt=null;
      updateBanner();
    });
    installBanner.querySelector('.pwaInstallClose').addEventListener('click',removeBanner);
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
