// This script randomly changes the greeting the user recieves.
// It's run before the page is visible to the user.
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const date = new Date();
const hour = date.getHours();
const dayGreeting = `Happy ${days[date.getDay()]}!`;
const timeGreeting = `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}!`
// Adding Days
const greetings = ["Hello!", "Ahoy!", "Howdy!", dayGreeting, timeGreeting];
const randomPick = Math.floor(Math.random() * greetings.length);
document.querySelector('#greeting').innerHTML = greetings[randomPick];