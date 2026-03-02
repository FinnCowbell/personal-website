import { Konami } from '/scripts/Konami.js';

// ========================================
// SONG CONFIGURATION
// Add your songs here with title, description, and file path
// ========================================
const songs = [
    {
        title: "Fungal Floor",
        description: "Boutique. On the Catwalk. MAY 2025",
        src: "/assets/music/boss-fights/Fungal Floor.mp3"
    },
    {
        title: "Clubbed",
        description: "AUG 2024",
        src: "/assets/music/boss-fights/Bassaline.mp3"
    },
    {
        title: "Mouse Army",
        description: "JAN 2024",
        src: "/assets/music/boss-fights/Twinning.mp3"
    },
    {
        title: "Wander",
        description: "Don't get lost. - JAN 2024",
        src: "/assets/music/boss-fights/Dug Fork.mp3"
    },
    {
        title: "Floor 7",
        description: "Almost there!.",
        src: "/assets/music/boss-fights/15M.mp3"
    },
    {
        title: "Honch",
        description: "*pixelated crowd cheers* - APR 2025",
        src: "/assets/music/boss-fights/SF.mp3"
    },
    {
        title: "Shadows",
        description: "Maybe they're friendly - FEB 2025",
        src: "/assets/music/boss-fights/M W Highs.mp3"
    },
    {
        title: "Gates'",
        description: "MAY 2021",
        src: "/assets/music/boss-fights/HARPIN.mp3"
    },
    {
        title: "Boulder",
        description: "H I. Created over 2 years. SEP 2023",
        src: "/assets/music/boss-fights/H I H.mp3"
    },
    {
        title: "Wonk 2A",
        description: "Stream of consciousness melody written in one sitting. FEB 2025",
        src: "/assets/music/boss-fights/WONK2A.mp3"
    }
];

const secretSong = {
    title: "Crabbin'",
    description: "MAY 2020",
    src: "/assets/music/boss-fights/Crabbin.mp3"
};

// ========================================
// PLAYER STATE & ELEMENTS
// ========================================
let currentIndex = 0;
let isPlaying = false;
let isRepeat = false;

const audio = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const repeatBtn = document.getElementById('repeatBtn');
const repeatIndicator = document.getElementById('repeatIndicator');
const songTitle = document.getElementById('songTitle');
const songDescription = document.getElementById('songDescription');
const playIcon = document.getElementById('playIcon');
const trackNumber = document.getElementById('trackNumber');
const progressMarker = document.getElementById('progressMarker');
const progressFill = document.getElementById('progressFill');
const progressContainer = document.getElementById('progressContainer');
const walkmanImage = document.getElementById('walkmanImage');
const loadingOverlay = document.getElementById('loadingOverlay');

// ========================================
// IMAGE LOADING & INITIALIZATION
// ========================================
function initializeApp() {
    // Unlock secret song function
    function unlockSecretSong() {
        if (localStorage.getItem('secretSongUnlocked') !== 'true') {
            songs.push(secretSong);
            localStorage.setItem('secretSongUnlocked', 'true');
        }
        // Jump to and play the secret song
        currentIndex = songs.length - 1;
        loadSong(currentIndex);
        audio.play();
        isPlaying = true;
        playBtn.classList.add('playing');
        playIcon.src = '/assets/img/bossfights/play.png';
        faviconScroller.start(songs[currentIndex].title);
    }

    // Check localStorage and add secret song if already unlocked
    if (localStorage.getItem('secretSongUnlocked') === 'true') {
        songs.push(secretSong);
    }

    // Set up Konami code to unlock secret song (desktop)
    const konami = new Konami(unlockSecretSong);
    konami.run();

    // Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return; // Skip if Konami code is being entered
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'ArrowRight') {
        nextSong();
    } else if (e.code === 'ArrowLeft') {
        prevSong();
    }
});

    // Mobile: tap the walkman logo 10 times to unlock
    let tapCount = 0;
    let tapTimeout = null;
    const TAP_THRESHOLD = 10;
    const TAP_RESET_DELAY = 2000; // Reset after 2 seconds of no taps

    const secretTapZone = document.getElementById('nothing-suspicious');
    if (secretTapZone) {
        secretTapZone.addEventListener('click', () => {
            tapCount++;
            clearTimeout(tapTimeout);
            
            if (tapCount >= TAP_THRESHOLD) {
                unlockSecretSong();
                tapCount = 0;
            } else {
                tapTimeout = setTimeout(() => {
                    tapCount = 0;
                }, TAP_RESET_DELAY);
            }
        });
    }

    loadSong(currentIndex);
    loadingOverlay.classList.add('hidden');
}

// ========================================
// TEXT SCROLLING FOR OVERFLOW
// ========================================

function isOverflowing(element) {
    return element.scrollWidth > element.clientWidth;
}

function setupTextScroller(element, text, scrollRef) {
    // Set full text first to check overflow
    element.textContent = text;

    // If not overflowing,  just display the text
    if (!isOverflowing(element)) {
        return;
    }

    const padding = '   •   ';

    // Add padding for scroll loop
    const paddedText = text + padding + text;
    let position = 0;

    const clearTimersIfExist = (ref) => {
        if (ref.intervalId) {
            clearInterval(ref.intervalId);
            ref.intervalId = null;
        }
        if (ref.timeoutId) {
            clearTimeout(ref.timeoutId);
            ref.timeoutId = null;
        }
    }
    const initScroll = () => {
        clearTimersIfExist(scrollRef);
        position = 0;   
        scrollRef.timeoutId = setTimeout(() => {
            clearTimersIfExist(scrollRef);
            scrollRef.intervalId = setInterval(scroll, 200); // Adjust speed here (ms per character)
        }, 2000); // Initial delay before scrolling starts
    }

    function scroll() {
        position++;
        if (position > text.length + padding.length) {
            initScroll();
        }
        element.textContent = paddedText.substring(position);
    }

    initScroll();
}

const titleScrollRef = { intervalId: null, timeoutId: null };
const descScrollRef = { intervalId: null, timeoutId: null };

// ========================================
// HELPER FUNCTIONS
// ========================================
function formatTrackNumber(num) {
    return String(num).padStart(3, '0');
}

// ========================================
// FAVICON SCROLLER INSTANCE
// ========================================
const faviconScroller = new FaviconScroller();

// ========================================
// PLAYER FUNCTIONS
// ========================================
function loadSong(index) {
    if (songs.length === 0) {
        songTitle.textContent = "No songs loaded";
        songDescription.textContent = "";
        return;
    }

    const song = songs[index];
    
    // Clear any existing timers
    if (titleScrollRef.intervalId) {
        clearInterval(titleScrollRef.intervalId);
        titleScrollRef.intervalId = null;
    }
    if (titleScrollRef.timeoutId) {
        clearTimeout(titleScrollRef.timeoutId);
        titleScrollRef.timeoutId = null;
    }
    if (descScrollRef.intervalId) {
        clearInterval(descScrollRef.intervalId);
        descScrollRef.intervalId = null;
    }
    if (descScrollRef.timeoutId) {
        clearTimeout(descScrollRef.timeoutId);
        descScrollRef.timeoutId = null;
    }
    
    // Set new audio source and reset
    audio.volume = 0.8; // Set default volume
    audio.src = song.src;
    audio.currentTime = 0;

    // Setup text scrollers for overflowing text
    const displayTitle = song.title.toUpperCase();
    setupTextScroller(songTitle, displayTitle, titleScrollRef);
    setupTextScroller(songDescription, song.description, descScrollRef);

    // Update favicon only if playing
    if (isPlaying) {
        faviconScroller.start(song.title);
    }

    trackNumber.textContent = formatTrackNumber(index + 1);
    progressMarker.style.left = '0%';
    progressFill.style.width = '0%';
}

function togglePlay() {
    if (songs.length === 0) return;

    if (isPlaying) {
        audio.pause();
        playBtn.classList.remove('playing');
        playIcon.src = '/assets/img/bossfights/pause.png';
        faviconScroller.restore();
    } else {
        audio.play();
        playBtn.classList.add('playing');
        playIcon.src = '/assets/img/bossfights/play.png';
        faviconScroller.start(songs[currentIndex].title);
    }
    isPlaying = !isPlaying;
}

function nextSong() {
    if (songs.length === 0) return;
    const wasPlaying = isPlaying;
    if (isPlaying) {
        audio.pause();
    }
    currentIndex = (currentIndex + 1) % songs.length;
    loadSong(currentIndex);
    if (wasPlaying) {
        // Wait for the new audio source to be ready before playing
        audio.addEventListener('loadeddata', function playOnLoad() {
            audio.removeEventListener('loadeddata', playOnLoad);
            audio.play();
            playBtn.classList.add('playing');
            playIcon.src = '/assets/img/bossfights/play.png';
        }, { once: true });
        audio.load(); // Trigger loading of new source
    }
}

function prevSong() {
    if (songs.length === 0) return;
    // If more than 3 seconds in, restart current song; otherwise go to previous
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
    } else {
        const wasPlaying = isPlaying;
        if (isPlaying) {
            audio.pause();
        }
        currentIndex = (currentIndex - 1 + songs.length) % songs.length;
        loadSong(currentIndex);
        if (wasPlaying) {
            // Wait for the new audio source to be ready before playing
            audio.addEventListener('loadeddata', function playOnLoad() {
                audio.removeEventListener('loadeddata', playOnLoad);
                audio.play();
                playBtn.classList.add('playing');
                playIcon.src = '/assets/img/bossfights/play.png';
            }, { once: true });
            audio.load(); // Trigger loading of new source
        }
    }
}

function updateProgress() {
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 99; // 98% max so marker stays in bounds
        const roundedPercent = Math.round(percent * 10) / 10; // Round to 0.1% intervals
        progressFill.style.width = roundedPercent + '%';
        progressMarker.style.left = roundedPercent + '%';
    }
}

function seekTo(e) {
    const rect = progressContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
}

// ========================================
// EVENT LISTENERS
// ========================================
playBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);
repeatBtn.addEventListener('click', toggleRepeat);

function toggleRepeat() {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle('active', isRepeat);
    repeatIndicator.classList.toggle('active', isRepeat);
}

function handleSongEnded() {
    if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
    } else {
        nextSong();
    }
}

audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('ended', handleSongEnded);

progressContainer.addEventListener('click', seekTo);


// Wait for image to load before initializing
if (walkmanImage.complete) {
    initializeApp();
} else {
    walkmanImage.addEventListener('load', initializeApp);
    walkmanImage.addEventListener('error', () => {
        console.error('Failed to load walkman image');
        initializeApp(); // Initialize anyway if image fails to load
    });
}