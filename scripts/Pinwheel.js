
export class PinWheel{
  //Accepts a list of elements that will be rotated, and handles the rotation physics.
  constructor(paths){
    this.paths = paths
    this.rotation = 0
    this.speed= 0;
    this.accel = .1;
    this.deccel= .05;
    // Once minspeed is arrived at, we move until we hit the next snapDegree
    this.minSpeed = .5
    this.maxSpeed = 5;
    this.pinDegree = 60;
    // Optionally, an offset can be added to adjust where in the rotation the "snap" occurs.
    this.pinDegreeOffset = 0;
  }
  iteratePhysics(){
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
  applySpeed(accel){
    this.speed += accel;
  }
  trySnap(){
    if(Math.floor(Math.abs(this.rotation) + this.pinDegreeOffset) % this.pinDegree == 0){
      this.rotation = Math.floor(this.rotation);
      this.speed = 0;
    }
  }
  updateElement(){
      this.paths.forEach((p)=>p.style.transform=`rotate(${this.rotation}deg)`);
  }
  tick(){
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