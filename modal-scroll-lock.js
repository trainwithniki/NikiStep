(function () {
  'use strict';

  const openModalSelector = [
    '.modal.open',
    '.overlay.open',
    '.confirmOv.open',
    '.personConfirmOverlay.open',
    '.settingsOv.open'
  ].join(',');

  const style = document.createElement('style');
  style.textContent = `
    html.modalScrollLocked,
    body.modalScrollLocked {
      overflow: hidden !important;
      overscroll-behavior: none;
    }
    body.modalScrollLocked {
      position: fixed !important;
      inset: var(--modal-scroll-top, 0) 0 auto 0;
      width: 100%;
    }
    .modal.open,
    .overlay.open,
    .confirmOv.open,
    .personConfirmOverlay.open,
    .settingsOv.open {
      overscroll-behavior: contain;
    }
    .modal.open .sheet,
    .overlay.open .editor,
    .settingsOv.open .settingsPanel,
    .confirmOv.open .confirmBox,
    .personConfirmOverlay.open .personConfirmBox {
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
    }
  `;
  document.head.appendChild(style);

  let locked = false;
  let savedScrollTop = 0;

  function lockBackground() {
    savedScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.setProperty('--modal-scroll-top', `-${savedScrollTop}px`);
    document.documentElement.classList.add('modalScrollLocked');
    document.body.classList.add('modalScrollLocked');
    locked = true;
  }

  function unlockBackground() {
    document.documentElement.classList.remove('modalScrollLocked');
    document.body.classList.remove('modalScrollLocked');
    document.body.style.removeProperty('--modal-scroll-top');
    const restoreTop = savedScrollTop;
    locked = false;
    window.scrollTo(0, restoreTop);
  }

  function syncScrollLock() {
    const shouldLock = !!document.querySelector(openModalSelector);
    if (shouldLock && !locked) lockBackground();
    if (!shouldLock && locked) unlockBackground();
  }

  const observer = new MutationObserver(syncScrollLock);
  observer.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class']
  });

  window.addEventListener('pageshow', syncScrollLock);
  syncScrollLock();
})();
