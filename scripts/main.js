import { Konami } from './Konami.js';
import { PinWheel } from './Pinwheel.js';

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

function showSecrets(){
  _.forEach(document.getElementsByClassName('secret'),(s)=>{s.removeAttribute("hidden")});
  document.querySelector('#masthead .finn').innerHTML = "Thomas";
}

function init(){
  let velocityHandler = new ScrollVelocity();
  let konami = new Konami(showSecrets);
  let hex = new PinWheel(document.querySelectorAll("#hexagon-clip #hexagon-path"));
  var flkty = new Flickity( '.main-carousel', {
    cellAlign: "left", wrapAround: true, autoPlay: 5000, pageDots: false
  });
  window.scrolled = 0;// Declaration
  document.addEventListener('scroll', function(e){
    //window.scrolled is set to a velocity.
    window.scrolled = velocityHandler.get()
  })

  setInterval(()=>{
    hex.tick();
    window.scrolled = 0;
  }, 1000/60);

  // Making the caurosel buttons add velocity in their directions
  flkty.prevButton.element.addEventListener('click', ()=>{hex.applySpeed(-2.4)});
  flkty.nextButton.element.addEventListener('click', ()=>{hex.applySpeed(2.4)});
  let hexActivators = document.querySelectorAll('#profile-pic');
  _.forEach(hexActivators, (x)=>{x.addEventListener('click', ()=>{hex.applySpeed(2.4)})});
  
  if(window.location.pathname == "/"){
    hex.applySpeed(2.4);
  }

  konami.run()
}
// With the script placed after the body, we don't need document.onload
init();