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
        title: "Bassaline",
        description: "Started before my first Ridgewood club visit, and finished after. AUG 2024",
        src: "/assets/music/boss-fights/Bassaline.mp3"
    },
    {
        title: "Twinning",
        description: "JAN 2024",
        src: "/assets/music/boss-fights/Twinning.mp3"
    },
    {
        title: "Dug",
        description: "Started while my sister was visiting NYC. JAN 2024",
        src: "/assets/music/boss-fights/Dug - Unfinished.mp3"
    },
    {
        title: "15M",
        description: "Elevator Interlude in 7 - Unknown.",
        src: "/assets/music/boss-fights/15M.mp3"
    },
    {
        title: "SF",
        description: "Cheeky. Inconsistent bitcrushing. APR 2025",
        src: "/assets/music/boss-fights/SF.mp3"
    },
    {
        title: "M",
        description: "Originally for Emma. FEB 2025",
        src: "/assets/music/boss-fights/M W Highs.mp3"
    },
    {
        title: "Harpin'",
        description: "MAY 2021",
        src: "/assets/music/boss-fights/HARPIN.mp3"
    },
    {
        title: "H I H",
        description: "The name depicts the drums. Created over 2 years. SEP 2023?",
        src: "/assets/music/boss-fights/H I H.mp3"
    },
    {
        title: "Wonk 2a",
        description: "Stream of consciousness melody written in one sitting. FEB 2025",
        src: "/assets/music/boss-fights/WONK2A.mp3"
    }
];

// ========================================
// PLAYER STATE & ELEMENTS
// ========================================
let currentIndex = 0;
let isPlaying = false;

const audio = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
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
    loadSong(currentIndex);
    loadingOverlay.classList.add('hidden');
}

// ========================================
// TEXT SCROLLING FOR OVERFLOW
// ========================================

function isOverflowing(element) {
    return element.scrollWidth > element.clientWidth;
}

function setupTextScroller(element, text, intervalRef) {
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

    const clearIntervalIfExists = (ref) => {
        if (ref.current) {
            clearInterval(ref.current);
            ref.current = null;
        }
    }
    const initScroll = () => {
        clearIntervalIfExists(intervalRef);
        position = 0;   
        setTimeout(() => {
            clearIntervalIfExists(intervalRef);
            intervalRef.current = setInterval(scroll, 200); // Adjust speed here (ms per character)
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

const titleScrollRef = { current: null };
const descScrollRef = { current: null };

// ========================================
// HELPER FUNCTIONS
// ========================================
function formatTrackNumber(num) {
    return String(num).padStart(3, '0');
}

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
    
    // Clear any existing intervals
    if (titleScrollRef.current) {
        clearInterval(titleScrollRef.current);
        titleScrollRef.current = null;
    }
    if (descScrollRef.current) {
        clearInterval(descScrollRef.current);
        descScrollRef.current = null;
    }
    
    // Set new audio source and reset
    audio.src = song.src;
    audio.currentTime = 0;

    // Setup text scrollers for overflowing text
    const displayTitle = song.title.toUpperCase();
    setupTextScroller(songTitle, displayTitle, titleScrollRef);
    setupTextScroller(songDescription, song.description, descScrollRef);

    trackNumber.textContent = formatTrackNumber(index + 1);
    progressMarker.style.left = '0%';
    progressFill.style.width = '0%';
}

function togglePlay() {
    if (songs.length === 0) return;

    if (isPlaying) {
        audio.pause();
        playBtn.classList.remove('playing');
        playIcon.textContent = '⏸';
    } else {
        audio.play();
        playBtn.classList.add('playing');
        playIcon.textContent = '▶';
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
            playIcon.textContent = '▶';
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
                playIcon.textContent = '▶';
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

audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('ended', nextSong);

progressContainer.addEventListener('click', seekTo);

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'ArrowRight') {
        nextSong();
    } else if (e.code === 'ArrowLeft') {
        prevSong();
    }
});


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