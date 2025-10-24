document.addEventListener("DOMContentLoaded", function () {
  const banner = document.getElementById("halloween-banner");
  let audio = null;

  banner.addEventListener("click", function () {
    // Stop any currently playing audio
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    // Create new audio instance and play
    audio = new Audio("/assets/img/halloween/happy halloween.m4a");
    audio.play().catch(function (error) {
      console.log("Audio playback failed:", error);
    });
  });

  // Trick or Treat functionality
  const rollButton = document.getElementById("roll-button");
  const resultDisplay = document.getElementById("result-display");
  const resultText = document.getElementById("result-text");
  const STORAGE_KEY = "polt-trick-or-treat";

  // Check if user has already rolled
  function checkExistingResult() {
    const resultType = localStorage.getItem(STORAGE_KEY);
    if (resultType) {
      const message = resultType === "trick" ? "Trick!" : "Treat!";
      showResult(resultType, message);
      rollButton.style.display = "none";
    }
  }

  // Show the result with appropriate styling
  function showResult(resultType, message) {
    resultDisplay.style.display = "block";
    resultDisplay.className = `result-display ${resultType}`;
    resultText.className = `${resultType} ${resultType === 'trick' ? 'scratchy' : 'gothic'}`;
    resultText.textContent = message;
  }

  // Handle the roll
  function rollForTrickOrTreat() {
    // Add spinning animation
    rollButton.classList.add('spinning');
    rollButton.textContent = 'Rolling...';
    
    // Wait for spin animation to complete
    setTimeout(() => {
      const isTrick = Math.random() < 0.5;
      const resultType = isTrick ? "trick" : "treat";
      const message = isTrick ? "Trick!" : "Treat!";

      // Store only the type in localStorage
      localStorage.setItem(STORAGE_KEY, resultType);

      // Show result and hide button
      showResult(resultType, message);
      rollButton.style.display = "none";
    }, 300); // Match the animation duration
  }

  // Initialize
  checkExistingResult();
  rollButton.addEventListener("click", rollForTrickOrTreat);
});
