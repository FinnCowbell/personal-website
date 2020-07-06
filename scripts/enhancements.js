function getVerticalLocation(item,trackFromBottom = true){
  /* returns the distance an item has travelled through a div,
  from 0 (top)
  ...
  to 1 (bottom)
  taking into account the entire height of the div.*/
  itemLocation = item.getBoundingClientRect();
  if(trackFromBottom){
    percentThrough = (itemLocation.bottom)/(window.innerHeight)
  } else{
    percentThrough = (itemLocation.top)/(window.innerHeight)
  }
  return percentThrough
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

function isOnScreen(item){
  itemLocation = item.getBoundingClientRect();
  return (itemLocation.y + itemLocation.height > 0) && (itemLocation.y < window.innerHeight);
}

function HexagonPinwheel(){
  this.svg = document.getElementById('hex-svg-1');
  this.img = document.getElementById('profile-img');
  this.content = document.getElementById('content');
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
    let clipPath = this.svg.children[0].children[0];
    //update the rotation
    clipPath.style.transform = `rotate(${this.rotation}deg)`
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

function NavBar(){
  this.navbar = document.querySelector('#nav-bar');
  if(!this.navbar){
    return;
  }
  this.reference = document.getElementById('masthead');
  this.status = "closed"
  this.setStatus = function(newStatus){
      this.status = newStatus;
  }
  this.closeNav = function(){
    this.navbar.style.top = "-" + this.navbar.getBoundingClientRect().height + "px";
  }
  this.openNav = function(){
    this.navbar.style.top = "0px"
  }
  this.tick = function(){
    let verticalLocation = getVerticalLocation(this.reference, true);
    if(verticalLocation <= 0 && this.status == "closed"){
      this.setStatus('open');
      this.openNav();
    } else if(verticalLocation > 0 && this.status != "closed"){
      this.setStatus('closed')
      this.closeNav()
    }
  }
}

function showSecret(){
  _.forEach(document.getElementsByClassName('secret'),(s)=>{s.removeAttribute("hidden")});
}

window.onload = function(){
  let hex = new HexagonPinwheel();
  let velocityHandler = new ScrollVelocity();
  let navBarHandler = new NavBar();
  window.scrolled = 0;// Declaration
  document.addEventListener('scroll', function(e){
    //window.scrolled is set to a velocity.
    window.scrolled = velocityHandler.get()
  })
  setInterval(()=>{
    hex.tick();
    navBarHandler.navbar && navBarHandler.tick();
    window.scrolled = 0;
  }, 1000/60);
  
  let hexImages = document.getElementsByClassName('hex');
  _.forEach(hexImages, (img)=>{img.onclick = ()=>{hex.applySpeed(2)}});

  let konami = new Konami();
  konami.activateFunction = showSecret;
  konami.run()
}