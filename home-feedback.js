(() => {
  'use strict';
  const sounds={robot:'robot',chunk:'chunk',accepted:'whoosh'};
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const button=control=>control?.matches('form')?control.querySelector('[type=submit]'):control;
  function play(name){try{return window.SAAudioMix?.buttonSound(sounds[name]);}catch{return null;}}
  window.SAHomeFeedback={
    async activate(control,sound){
      window.SAAudioMix?.unlock();
      const target=button(control);target?.classList.add('home-activating');target?.setAttribute('aria-busy','true');
      play(sound);
      await wait(500);
      target?.classList.remove('home-activating');
    },
    release(control){const target=button(control);target?.classList.remove('home-activating');target?.removeAttribute('aria-busy');},
    accepted(){} // Entry completion has no second button sound; the submitted control owns feedback.
  };
})();
