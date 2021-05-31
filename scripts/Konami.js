//There's no vanilla-js search array-in-array function! Strings it is.
export var Konami = function(activateFunction = ()=>console.log("Konami Activated!")){
   this.code = "38384040373937396665";
   this.recorded = "";
   this.activateFunction = activateFunction;
   this.run =function(){
    let konami = this
    document.addEventListener('keydown', function(k){
      konami.recorded += k.keyCode;
      if (konami.code == konami.recorded) {
        konami.activateFunction();
        konami.recorded = "";
      }
      konami.recorded = konami.code.indexOf(konami.recorded) == 0 ? konami.recorded : ""
      //I dont want to make a keylogger. if the logging doesn't match the constant then fuggedaboutit
    })}
  }
//  this.activated = partial(completed,param,.95);
//partials allow you to create functions with conditions
