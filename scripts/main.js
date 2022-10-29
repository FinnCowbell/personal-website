import { Konami } from '/scripts/Konami.js';
import { PinWheel } from '/scripts/Pinwheel.js';

const isSafari = !!(window.safari)

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
  let pinwheelElements = document.querySelectorAll("#hexagon-clip #hexagon-path");
  function showSecrets(){
    _.forEach(document.getElementsByClassName('secret'),(s)=>{s.removeAttribute("hidden")});
    const nameElement = document.querySelector('#masthead .finn')
    nameElement.innerHTML = "Thomas";
    pinwheelElements.push(nameElement);
  }
  let velocityHandler = new ScrollVelocity();
  let konami = new Konami(showSecrets);
  let hex = new PinWheel(pinwheelElements);
  let prevIndex = 1;
  var flkty = new Flickity( '.main-carousel', {
    cellAlign: "left", 
    wrapAround: true, 
    dragThreshold: 10, 
    autoPlay: 5000, 
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
  konami.run()
  if (isSafari){
    document.querySelector('#hex-svg').style.transform = 'translate(16px)';
    document.querySelector('#hexagon-clip').style.transform = '';
    return;
  }
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