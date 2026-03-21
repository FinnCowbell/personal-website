import { Konami } from '/scripts/Konami.js';
import { PinWheel } from '/scripts/Pinwheel.js';

function buildSvgMaskUrl(pathData, offsetX = 0){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><path fill="black" transform="translate(${offsetX} 0)" d="${pathData}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function shouldUseProfileClipFallback(){
  const userAgent = navigator.userAgent;
  const platform = navigator.platform || '';
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent)
    || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOSDevice){
    return true;
  }

  return /Safari/i.test(userAgent) && !/Chrome|Chromium|Android|CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
}

function getPinwheelElements(useProfileClipFallback){
  const selector = useProfileClipFallback
    ? '[data-profile-clip-fallback-mask], [data-profile-clip-fallback-image]'
    : '#hexagon-clip #hexagon-path';

  return Array.from(document.querySelectorAll(selector));
}

function ScrollVelocity(){
  this.st = window.pageYOffset || document.documentElement.scrollTop;
  this.lastScrollTop = -1;
  this.get = function(){
      this.st = window.pageYOffset || document.documentElement.scrollTop;
      let vel = this.st - this.lastScrollTop;
      this.lastScrollTop = this.st <= 0 ? 0 : this.st;
      return vel;
  }
}

function init(){
  const useProfileClipFallback = shouldUseProfileClipFallback();
  document.documentElement.classList.toggle('profile-pic-clip-fallback', useProfileClipFallback);

  if (useProfileClipFallback){
    const fallbackContainer = document.querySelector('.profile-pic-fallback');
    const svgProfile = document.querySelector('#hex-svg');

    if (fallbackContainer){
      fallbackContainer.style.display = 'block';
      const maskPath = fallbackContainer.dataset.profileMaskPath;
      const maskOffsetX = Number(fallbackContainer.dataset.profileMaskOffsetX || 0);

      if (maskPath){
        const maskUrl = buildSvgMaskUrl(maskPath, maskOffsetX);
        fallbackContainer.style.webkitMaskImage = maskUrl;
        fallbackContainer.style.maskImage = maskUrl;
        fallbackContainer.style.webkitMaskRepeat = 'no-repeat';
        fallbackContainer.style.maskRepeat = 'no-repeat';
        fallbackContainer.style.webkitMaskSize = '100% 100%';
        fallbackContainer.style.maskSize = '100% 100%';
        fallbackContainer.style.webkitMaskPosition = 'center';
        fallbackContainer.style.maskPosition = 'center';
      }
    }

    if (svgProfile){
      svgProfile.style.display = 'none';
    }
  }

  let pinwheelElements = getPinwheelElements(useProfileClipFallback);
  function showSecrets(){
    _.forEach(document.getElementsByClassName('secret'),(s)=>{s.removeAttribute("hidden")});
    const nameElement = document.querySelector('#masthead .finn')
    nameElement.innerHTML = "Thomas";
    pinwheelElements.push(nameElement);
  }
  let velocityHandler = new ScrollVelocity();
  let konami = new Konami(showSecrets);
  let hex = new PinWheel(pinwheelElements);
  const carouselElement = document.querySelector('.main-carousel');

  if (carouselElement){
    let prevIndex = 1;
    new Flickity(carouselElement, {
      cellAlign: "left", 
      wrapAround: true, 
      dragThreshold: 10, 
      autoPlay: 7000, 
      pageDots: false, 
      setGallerySize: false,
      on: {
        change: ( index ) => {
          if(index-prevIndex == 1 || index-prevIndex < -1)
            hex.applySpeed(2.4)
          else 
            hex.applySpeed(-2.4);
          prevIndex = index;
        }
      }});
  }
  konami.run()
  window.scrolled = 0;// Declaration
  document.addEventListener('scroll', function(e){
    //window.scrolled is set to a velocity.
    window.scrolled = velocityHandler.get()
  })
  setInterval(()=>{
    hex.tick();
    window.scrolled = 0;
  }, 1000/60);
  _.forEach(document.querySelectorAll('.socials'), (x)=>{x.addEventListener('click',()=>{hex.applySpeed(10)} )});
  _.forEach(document.querySelectorAll('#profile-pic'), (x)=>{x.addEventListener('click', ()=>{hex.applySpeed(2.4)})});
  
  if(window.location.pathname == "/"){
    // Give a little spin if we're on the main menu
    setTimeout(()=>{
      hex.applySpeed(2.4);
    },1000);
  }
}
// With the script placed after the body, we don't need document.onload
init();