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

function HexagonPinwheel(path){
  "Accepts the SVG path that will be rotated, and handles the rotation physics."
  this.svgPath = path
  this.rotation = 0
  this.speed= 0;
  this.accel = .1;
  this.deccel= .05;
  //Once minspeed is arrived at, we move until we hit the next snapDegreeInterval
  this.snapDegreeIntervals = 60;
  this.minSpeed = .5
  this.maxSpeed = 5;
  this.iteratePhysics= function(){
    this.rotation += this.speed;
    this.rotation = this.rotation % 360;
    if(this.speed > this.minSpeed){
        this.speed -= this.deccel;
    } else if (this.speed < -this.minSpeed){
        this.speed += this.deccel;
    } else if(this.speed){
      this.trySnap();
    }
  }
  this.applySpeed= function(accel){
    this.speed += accel;
  }
  this.trySnap = function(){
    if(Math.floor(Math.abs(this.rotation)) % this.snapDegreeIntervals == 0){
      this.rotation = Math.floor(this.rotation);
      this.speed = 0;
    }
  }
  this.updateElement= function(){
      this.svgPath.forEach((p)=>p.style.transform=`rotate(${this.rotation}deg)`);
  }
  this.tick = function(){
    if(window.scrolled != 0){
      this.applySpeed(window.scrolled * this.accel);
      if(this.speed >= this.maxSpeed){
        this.speed = this.maxSpeed;
      } else if(-this.maxSpeed >= this.speed){
        this.speed = -this.maxSpeed;
      }
    }
    this.iteratePhysics();
    this.updateElement();
  }
}

function showSecret(){
  _.forEach(document.getElementsByClassName('secret'),(s)=>{s.removeAttribute("hidden")});
}
  
var flkty = new Flickity( '.main-carousel', {
  cellAlign: "left", wrapAround: true, autoPlay: 5000, pageDots: false
});

window.onload = function(){
  let hex = new HexagonPinwheel(document.querySelectorAll("#hexagon-clip #hexagon-path"));
  let velocityHandler = new ScrollVelocity();
  // let navBarHandler = new NavBar();
  window.scrolled = 0;// Declaration
  document.addEventListener('scroll', function(e){
    //window.scrolled is set to a velocity.
    window.scrolled = velocityHandler.get()
  })
  setInterval(()=>{
    hex.tick();
    // navBarHandler.navbar && navBarHandler.tick();
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

  let konami = new Konami();
  konami.activateFunction = showSecret;
  konami.run()
}