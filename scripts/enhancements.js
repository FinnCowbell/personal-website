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
  if (percentThrough > 1){
    return 1
  } else if (percentThrough > 0){
    return percentThrough
  }
  return 0
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
  this.standBySpeed = .5
  this.deccel= .05;
  this.maxSpeed = 5;
  this.rotateHexagon= function(){
    this.rotation += this.speed;
    this.rotation = this.rotation % 360;
    if(this.speed > this.standBySpeed){
        this.speed -= this.deccel;
    } else if (this.speed < -this.standBySpeed){
        this.speed += this.deccel;
    } else if(this.speed){
      this.trySnap();
    }
  }
  this.applySpeed= function(accel){
    if(this.speed/accel <= 0){ //accel and speed Different signs
      this.speed = 0;
    }
    this.speed += accel;
  }
  this.trySnap = function(){
    if(Math.floor(Math.abs(this.rotation)) % 60 == 0){
      this.rotation = Math.floor(this.rotation);
      this.speed = 0;
    }
  }
  this.updateElement= function(){
    this.svg.children[0].children[0].style.transform = `rotate(${this.rotation}deg)`
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
    this.rotateHexagon();
    this.updateElement();
  }
  return self;
}

function NavBar(){
  this.navbar = document.getElementById('nav-bar') || false;
  if(this.navbar == false){
    return false
  }
  this.reference = document.getElementById('masthead');
  this.status = "closed"
  this.setStatus = function(newStatus){
    if(newStatus != this.status){
      this.status = newStatus;
      this.updatePosition();
    }
  }
  this.updatePosition = function(){
    let rect = this.navbar.getBoundingClientRect();
    if(this.status == "closed"){
      this.navbar.style.top = `${-rect.height}px`
    } else{
      this.navbar.style.top = `${0}px`
    }
  }
  this.tick = function(){
    let verticalLocation = getVerticalLocation(this.reference, true);
    if(verticalLocation == 0){
      this.setStatus('open');
    } else{
      this.setStatus('closed');
    }
  }
}

function realName(){
  _.forEach(document.getElementsByClassName('finn'), (name)=>{name.innerHTML="Thomas"});
}

function showSecret(){
  _.forEach(document.getElementsByClassName('secret'),(s)=>{s.removeAttribute("hidden")});
}

window.onload = function(){
  let hex = HexagonPinwheel();
  let velocityHandler = new ScrollVelocity();
  let navBarHandler = new NavBar();
  navBarHandler && navBarHandler.updatePosition();
  window.scrolled = 0;
  document.addEventListener('scroll', function(e){
    //window.scrolled is set to a velocity.
    window.scrolled = velocityHandler.get()
  })
  setInterval(()=>{
    hex.tick();
    navBarHandler && navBarHandler.tick();
    window.scrolled = 0;
  }, 1000/60);
  hex.img.onclick = ()=> {hex.applySpeed(2)}

  let konami = new Konami();
  konami.activateFunction = showSecret;
  konami.run()
}