import { Konami } from '/scripts/Konami.js';
import { mediaMetadata, secretSong, songs } from './player-data.js';
import { shouldUseNativeTransport } from './player-shared.js';
import { SegmentPlayer } from './segment-player.js';

let currentIndex = 0;
let hasSkipped = false;
let unlockSecretSong = null;
let hasLoadedTrack = false;

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
const loopStartMarker = document.getElementById('loopStartMarker');
const loopEndMarker = document.getElementById('loopEndMarker');
const walkmanImage = document.getElementById('walkmanImage');
const loadingOverlay = document.getElementById('loadingOverlay');
const songIcon = document.getElementById('songIcon');
const audioElement = document.getElementById('audioPlayer');
const preloadedSongIcons = [];

function preloadSongIcons() {
    const iconSources = new Set(
        [...songs, secretSong]
            .map((song) => song?.icon)
            .filter(Boolean)
    );

    for (const iconSrc of iconSources) {
        const image = new Image();
        image.decoding = 'async';
        image.src = iconSrc;
        preloadedSongIcons.push(image);
    }
}

if (document.readyState === 'complete') {
    preloadSongIcons();
} else {
    window.addEventListener('load', preloadSongIcons, { once: true });
}

function isOverflowing(element) {
    return element.scrollWidth > element.clientWidth;
}

function setupTextScroller(element, text, scrollRef) {
    element.textContent = text;

    if (!isOverflowing(element)) {
        return;
    }

    const padding = '   •   ';
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
    };

    const initScroll = () => {
        clearTimersIfExist(scrollRef);
        position = 0;
        scrollRef.timeoutId = setTimeout(() => {
            clearTimersIfExist(scrollRef);
            scrollRef.intervalId = setInterval(scroll, 200);
        }, 2000);
    };

    function scroll() {
        position += 1;
        if (position > text.length + padding.length) {
            initScroll();
            return;
        }
        element.textContent = paddedText.substring(position);
    }

    initScroll();
}

const titleScrollRef = { intervalId: null, timeoutId: null };
const descScrollRef = { intervalId: null, timeoutId: null };

function clearTextScrollers() {
    for (const ref of [titleScrollRef, descScrollRef]) {
        if (ref.intervalId) {
            clearInterval(ref.intervalId);
            ref.intervalId = null;
        }
        if (ref.timeoutId) {
            clearTimeout(ref.timeoutId);
            ref.timeoutId = null;
        }
    }
}

function formatTrackNumber(num) {
    return String(num).padStart(3, '0');
}

function clampMarkerPercent(percent) {
    return Math.min(Math.max(percent, 0.4), 99.6);
}

function timeToPercent(time, duration) {
    if (!duration) {
        return 0;
    }

    return Math.min(Math.max((time / duration) * 100, 0), 100);
}

function setLoopMarker(marker, percent, visible) {
    if (!marker) {
        return;
    }

    marker.style.left = `${percent}%`;
    marker.classList.toggle('visible', visible);
}

function updateLoopMarkers({ repeatEnabled, duration, loopWindow }) {
    const hasLoopWindow = repeatEnabled && duration && loopWindow && Number.isFinite(loopWindow.start) && Number.isFinite(loopWindow.end);

    if (!hasLoopWindow) {
        setLoopMarker(loopStartMarker, 0, false);
        setLoopMarker(loopEndMarker, 0, false);
        return;
    }

    setLoopMarker(loopStartMarker, clampMarkerPercent(timeToPercent(loopWindow.start, duration)), true);
    setLoopMarker(loopEndMarker, clampMarkerPercent(timeToPercent(loopWindow.end, duration)), true);
}

const faviconScroller = new FaviconScroller();

const useNativeTransport = shouldUseNativeTransport({
    search: window.location.search,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform
});

const player = new SegmentPlayer({
    audioElement,
    enableMediaSession: useNativeTransport,
    volume: 0.8,
    maxRepeats: 10,
    maxPlaybackMinutes: 30,
    onStateChange: syncPlayerState,
    onProgress: updateProgress,
    onTrackEnded: handleSongEnded,
    onPreviousTrack: () => {
        void prevSong({ userInitiated: false });
    },
    onNextTrack: () => {
        void nextSong({ userInitiated: false, autoplay: true });
    }
});

console.info(`Using segment player (mediaSession=${useNativeTransport}) for ${mediaMetadata.album} player`);

function addSecretSongIfNeeded() {
    const alreadyPresent = songs.some((song) => song.src === secretSong.src);
    if (!alreadyPresent) {
        songs.push(secretSong);
    }
}

async function unlockAudioIfNeeded() {
    if (player.isAudioUnlocked()) {
        return true;
    }

    try {
        await player.unlockAudio();
        return true;
    } catch (error) {
        console.error('Failed to unlock audio', error);
        return false;
    }
}

async function canRunAudioAction({ userInitiated = true } = {}) {
    return !userInitiated || await unlockAudioIfNeeded();
}

async function runWithUnlockedAudio(action, { userInitiated = true } = {}) {
    if (!await canRunAudioAction({ userInitiated })) {
        return false;
    }

    await action();
    return true;
}

function primeAudioUnlock(target) {
    if (!target) {
        return;
    }

    const unlock = () => {
        void unlockAudioIfNeeded();
    };

    target.addEventListener('pointerdown', unlock, { passive: true });
    target.addEventListener('touchstart', unlock, { passive: true });
}

async function initializeApp() {
    unlockSecretSong = async function() {
        const didUnlockAudio = await unlockAudioIfNeeded();
        if (!didUnlockAudio) {
            return;
        }

        if (localStorage.getItem('secretSongUnlocked') !== 'true') {
            addSecretSongIfNeeded();
            localStorage.setItem('secretSongUnlocked', 'true');
        }

        currentIndex = songs.findIndex((song) => song.src === secretSong.src);
        await loadSong(currentIndex, { autoplay: true, resetSkipState: false });
    };

    if (localStorage.getItem('secretSongUnlocked') === 'true') {
        addSecretSongIfNeeded();
    }

    const konami = new Konami(unlockSecretSong);
    konami.run();

    document.addEventListener('keydown', async (event) => {
        if (event.defaultPrevented) {
            return;
        }

        if (event.code === 'Space') {
            event.preventDefault();
            await togglePlay();
        } else if (event.code === 'ArrowRight') {
            await nextSong({ userInitiated: true });
        } else if (event.code === 'ArrowLeft') {
            await prevSong({ userInitiated: true });
        }
    });

    let tapCount = 0;
    let tapTimeout = null;
    const secretTapZone = document.getElementById('nothing-suspicious');

    if (secretTapZone) {
        primeAudioUnlock(secretTapZone);

        secretTapZone.addEventListener('click', async () => {
            tapCount += 1;
            clearTimeout(tapTimeout);

            if (tapCount >= 5) {
                await unlockSecretSong();
                tapCount = 0;
                return;
            }

            tapTimeout = setTimeout(() => {
                tapCount = 0;
            }, 2000);
        });
    }

    renderSong(songs[currentIndex], currentIndex);
    syncPlayerState(player.getState());
    loadingOverlay.classList.add('hidden');
}

function renderSong(song, index) {
    clearTextScrollers();

    const displayTitle = song.title.toUpperCase();
    setupTextScroller(songTitle, displayTitle, titleScrollRef);
    setupTextScroller(songDescription, song.description, descScrollRef);

    if (song.icon) {
        songIcon.src = song.icon;
        songIcon.alt = `${song.title} icon`;
    }

    trackNumber.textContent = formatTrackNumber(index + 1);
    progressFill.style.width = '0%';
    progressMarker.style.left = '0%';
    updateLoopMarkers({ repeatEnabled: false, duration: 0, loopWindow: null });
}

function getNextSong(index = currentIndex) {
    if (songs.length < 2) {
        return null;
    }

    const nextIndex = (index + 1) % songs.length;
    return songs[nextIndex] ?? null;
}

async function preloadUpcomingSong(index = currentIndex) {
    if (!player.isAudioUnlocked()) {
        return;
    }

    const nextSong = getNextSong(index);
    if (!nextSong) {
        return;
    }

    try {
        await player.preloadTrack(nextSong, { priority: 'low' });
    } catch (error) {
        console.warn('Failed to preload next track', error);
    }
}

async function loadSong(index, { autoplay = false, resetSkipState = false } = {}) {
    if (songs.length === 0) {
        songTitle.textContent = 'No songs loaded';
        songDescription.textContent = '';
        return false;
    }

    currentIndex = index;
    if (resetSkipState) {
        hasSkipped = false;
    }

    const song = songs[index];
    renderSong(song, index);

    try {
        const didLoad = await player.loadTrack(song, { autoplay });
        if (!didLoad) {
            return false;
        }

        hasLoadedTrack = true;

        syncPlayerState(player.getState());
        updateProgress(player.getState());
        void preloadUpcomingSong(index);
        return true;
    } catch (error) {
        console.error('Failed to load track', error);
        hasLoadedTrack = false;
        songTitle.textContent = 'Track failed to load';
        songDescription.textContent = song.title;
        return false;
    }
}

async function togglePlay() {
    if (songs.length === 0) {
        return;
    }

    if (player.getState().isPlaying) {
        player.pause();
        return;
    }

    await runWithUnlockedAudio(async () => {
        if (!hasLoadedTrack) {
            await loadSong(currentIndex, { autoplay: true, resetSkipState: false });
            return;
        }

        try {
            await player.play();
        } catch (error) {
            console.error('Playback failed', error);
        }
    });
}

async function nextSong({ userInitiated = false, autoplay = null } = {}) {
    if (songs.length === 0) {
        return;
    }

    if (!await canRunAudioAction({ userInitiated })) {
        return;
    }

    if (userInitiated) {
        hasSkipped = true;
    }

    const wasPlaying = autoplay ?? player.getState().isPlaying;
    const nextIndex = (currentIndex + 1) % songs.length;
    await loadSong(nextIndex, { autoplay: wasPlaying });
}

async function prevSong({ userInitiated = false } = {}) {
    if (songs.length === 0) {
        return;
    }

    if (!await canRunAudioAction({ userInitiated })) {
        return;
    }

    const state = player.getState();
    if (state.currentTime > 3) {
        await player.seek(0);
        return;
    }

    if (userInitiated) {
        hasSkipped = true;
    }

    const wasPlaying = state.isPlaying;
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    await loadSong(prevIndex, { autoplay: wasPlaying });
}

function updateProgress(state) {
    const { currentTime, duration } = state;
    updateLoopMarkers(state);

    if (!duration) {
        progressFill.style.width = '0%';
        progressMarker.style.left = '0%';
        return;
    }

    const roundedPercent = Math.round(timeToPercent(currentTime, duration) * 10) / 10;
    progressFill.style.width = `${roundedPercent}%`;
    progressMarker.style.left = `${roundedPercent}%`;
}

async function seekTo(event) {
    if (!await canRunAudioAction()) {
        return;
    }

    const state = player.getState();
    if (!state.duration) {
        return;
    }

    const rect = progressContainer.getBoundingClientRect();
    const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const newTime = percent * state.duration;

    const isSkip = Math.abs(newTime - state.currentTime) > (state.duration * 0.1);
    hasSkipped ||= isSkip;

    await player.seek(newTime);
}

async function toggleRepeat() {
    if (!await canRunAudioAction()) {
        return;
    }

    await player.toggleRepeat();
}

function syncPlayerState(state) {
    playBtn.classList.toggle('playing', state.isPlaying);
    const newPlayIconSrc = state.isPlaying
        ? '/assets/img/bossfights/play.png'
        : '/assets/img/bossfights/pause.png';
    if (!playIcon.src.endsWith(newPlayIconSrc)) {
        playIcon.src = newPlayIconSrc;
    }

    repeatBtn.classList.toggle('active', state.repeatEnabled);
    repeatIndicator.classList.toggle('active', state.repeatEnabled);
    repeatIndicator.textContent = state.breakoutActive ? 'END' : 'RPT';
    updateLoopMarkers(state);

    const activeSong = songs[currentIndex];
    if (state.isPlaying && activeSong) {
        faviconScroller.start(activeSong.title);
    } else {
        faviconScroller.restore();
    }
}

async function handleSongEnded() {
    const secretUnlocked = localStorage.getItem('secretSongUnlocked') === 'true';
    const lastOriginalIndex = songs.some((song) => song.src === secretSong.src)
        ? songs.length - 2
        : songs.length - 1;

    if (!hasSkipped && currentIndex === lastOriginalIndex && !secretUnlocked) {
        await unlockSecretSong();
        return;
    }

    await nextSong({ userInitiated: false, autoplay: true });
}

primeAudioUnlock(playBtn);
primeAudioUnlock(nextBtn);
primeAudioUnlock(prevBtn);
primeAudioUnlock(repeatBtn);
primeAudioUnlock(progressContainer);

playBtn.addEventListener('click', () => {
    void togglePlay();
});

nextBtn.addEventListener('click', () => {
    void nextSong({ userInitiated: true });
});

prevBtn.addEventListener('click', () => {
    void prevSong({ userInitiated: true });
});

repeatBtn.addEventListener('click', () => {
    void toggleRepeat();
});

progressContainer.addEventListener('click', (event) => {
    void seekTo(event);
});

if (walkmanImage.complete) {
    void initializeApp();
} else {
    walkmanImage.addEventListener('load', () => {
        void initializeApp();
    });
    walkmanImage.addEventListener('error', () => {
        console.error('Failed to load walkman image');
        void initializeApp();
    });
}