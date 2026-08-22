(function(){
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }

  let installPrompt=null;
  let installBanner=null;

  function isInstalled(){
    return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  }

  function removeBanner(){
    installBanner?.remove();
    installBanner=null;
  }

  function showInstallBanner(){
    if(!installPrompt||installBanner||isInstalled())return;
    installBanner=document.createElement('aside');
    installBanner.className='pwaInstallBanner';
    installBanner.setAttribute('aria-label','Инсталиране на приложението');
    installBanner.innerHTML='<img src="assets/icons/icon-192.png" alt=""><span><strong>Step с Niki</strong><small>Добави като приложение</small></span><button class="pwaInstallAction" type="button">Инсталирай</button><button class="pwaInstallClose" type="button" aria-label="Затвори">×</button>';

    const style=document.createElement('style');
    style.textContent='.pwaInstallBanner{position:fixed;z-index:1200;left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));display:grid;grid-template-columns:42px minmax(0,1fr) auto 28px;align-items:center;gap:9px;max-width:520px;margin:0 auto;padding:8px 8px 8px 9px;border:1px solid rgba(255,255,255,.18);border-radius:15px;background:rgba(20,22,27,.96);box-shadow:0 10px 35px rgba(0,0,0,.32);color:#fff;font-family:Inter,system-ui,sans-serif;backdrop-filter:blur(12px)}.pwaInstallBanner img{width:42px;height:42px;border-radius:11px;object-fit:cover}.pwaInstallBanner span{min-width:0}.pwaInstallBanner strong,.pwaInstallBanner small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pwaInstallBanner strong{font-size:13px}.pwaInstallBanner small{margin-top:2px;color:#bfc5ca;font-size:10px;font-weight:700}.pwaInstallAction{min-height:34px;border:0;border-radius:9px;padding:6px 10px;background:#57c982;color:#0a2717;font-size:11px;font-weight:950}.pwaInstallClose{width:28px;height:28px;border:0;background:transparent;color:#cbd0d4;font-size:22px;line-height:1}@media(max-width:390px){.pwaInstallBanner{grid-template-columns:38px minmax(0,1fr) auto 24px;gap:7px}.pwaInstallBanner img{width:38px;height:38px}.pwaInstallAction{padding:5px 8px}}';
    document.head.appendChild(style);
    document.body.appendChild(installBanner);

    installBanner.querySelector('.pwaInstallAction').addEventListener('click',async()=>{
      if(!installPrompt)return;
      installPrompt.prompt();
      const choice=await installPrompt.userChoice;
      if(choice.outcome==='accepted')removeBanner();
      installPrompt=null;
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
    removeBanner();
  });
})();
