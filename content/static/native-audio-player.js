import { normalizeSegments, resolvePlaybackState as resolveSegmentPlaybackState } from './native-audio-player-logic.js';
import { buildTrackMediaMetadata } from './player-data.js';

export class NativeAudioPlayer {
    constructor({
        audioElement,
        onStateChange,
        onProgress,
        onTrackEnded,
        onPreviousTrack,
        onNextTrack,
        preferFullTrackWhenRepeatDisabled = false,
        volume = 0.8
    } = {}) {
        if (!audioElement) {
            throw new Error('NativeAudioPlayer requires an audio element');
        }

        this.audio = audioElement;
        this.audio.preload = 'metadata';
        this.audio.volume = volume;

        this.onStateChange = onStateChange;
        this.onProgress = onProgress;
        this.onTrackEnded = onTrackEnded;
        this.onPreviousTrack = onPreviousTrack;
        this.onNextTrack = onNextTrack;
        this.preferFullTrackWhenRepeatDisabled = Boolean(preferFullTrackWhenRepeatDisabled);

        this.currentTrack = null;
        this.repeatEnabled = false;
        this.audioUnlocked = false;
        this.segmentConfig = null;
        this.currentMode = 'full';
        this.transitionInFlight = null;
        this.pendingPlaybackPosition = null;
        this.playbackRequested = false;

        this.boundOnPlay = this.handlePlaybackEvent.bind(this);
        this.boundOnPause = this.handlePlaybackEvent.bind(this);
        this.boundOnSeeked = this.handleSeeked.bind(this);
        this.boundOnTimeUpdate = this.handleTimeUpdate.bind(this);
        this.boundOnLoadedMetadata = this.handleLoadedMetadata.bind(this);
        this.boundOnDurationChange = this.handleLoadedMetadata.bind(this);
        this.boundOnEnded = this.handleEnded.bind(this);
        this.boundOnError = this.handleError.bind(this);
        this.boundOnPageShow = this.handlePageShow.bind(this);
        this.boundOnVisibilityChange = this.handleVisibilityChange.bind(this);

        this.attachEventListeners();
        this.setupMediaSessionHandlers();
    }

    attachEventListeners() {
        this.audio.addEventListener('play', this.boundOnPlay);
        this.audio.addEventListener('pause', this.boundOnPause);
        this.audio.addEventListener('seeked', this.boundOnSeeked);
        this.audio.addEventListener('timeupdate', this.boundOnTimeUpdate);
        this.audio.addEventListener('loadedmetadata', this.boundOnLoadedMetadata);
        this.audio.addEventListener('durationchange', this.boundOnDurationChange);
        this.audio.addEventListener('ended', this.boundOnEnded);
        this.audio.addEventListener('error', this.boundOnError);
        window.addEventListener('pageshow', this.boundOnPageShow);
        document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
    }

    removeEventListeners() {
        this.audio.removeEventListener('play', this.boundOnPlay);
        this.audio.removeEventListener('pause', this.boundOnPause);
        this.audio.removeEventListener('seeked', this.boundOnSeeked);
        this.audio.removeEventListener('timeupdate', this.boundOnTimeUpdate);
        this.audio.removeEventListener('loadedmetadata', this.boundOnLoadedMetadata);
        this.audio.removeEventListener('durationchange', this.boundOnDurationChange);
        this.audio.removeEventListener('ended', this.boundOnEnded);
        this.audio.removeEventListener('error', this.boundOnError);
        window.removeEventListener('pageshow', this.boundOnPageShow);
        document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
    }

    async loadTrack(track, { autoplay = false, startTime = 0 } = {}) {
        this.currentTrack = track;
        this.segmentConfig = this.normalizeSegments(track);
        this.playbackRequested = Boolean(autoplay);

        const nextState = this.resolvePlaybackState(startTime);
        await this.applyPlaybackState(nextState);

        if (autoplay) {
            await this.play();
        } else {
            this.emitProgress();
            this.emitState();
        }

        return true;
    }

    preloadTrack() {
        return Promise.resolve(null);
    }

    async play() {
        if (!this.currentTrack) {
            return;
        }

        this.playbackRequested = true;

        try {
            await this.audio.play();
            this.audioUnlocked = true;
            this.updateMediaSession();
            this.emitState();
        } catch (error) {
            this.playbackRequested = false;
            this.updateMediaSession();
            this.emitState();
            throw error;
        }
    }

    pause() {
        this.playbackRequested = false;
        this.audio.pause();
        this.updateMediaSession();
        this.emitProgress();
        this.emitState();
    }

    async seek(seconds) {
        if (!this.currentTrack) {
            return;
        }

        const wasPlaying = this.playbackRequested;
        const nextState = this.resolvePlaybackState(seconds);
        await this.applyPlaybackState(nextState);

        if (wasPlaying) {
            await this.play();
        } else {
            this.emitProgress();
            this.emitState();
        }
    }

    async setRepeat(enabled) {
        const nextRepeatEnabled = Boolean(enabled);
        const repeatValueChanged = this.repeatEnabled !== nextRepeatEnabled;
        const wasUsingSegmentedPlayback = this.shouldUseSegmentedPlayback();
        const wasPlaying = this.playbackRequested;
        const currentTime = this.getCurrentTime();

        this.repeatEnabled = nextRepeatEnabled;

        if (repeatValueChanged && this.currentTrack) {
            const shouldUseSegmentedPlayback = this.shouldUseSegmentedPlayback();
            if (wasUsingSegmentedPlayback !== shouldUseSegmentedPlayback) {
                const nextState = this.resolvePlaybackState(currentTime);
                await this.applyPlaybackState(nextState);

                if (wasPlaying) {
                    await this.play();
                    return;
                }

                this.updateMediaSession();
                this.emitProgress();
                this.emitState();
                return;
            }
        }

        this.audio.loop = this.shouldLoopCurrentMode();
        this.updateMediaSession();
        this.emitProgress();
        this.emitState();
    }

    toggleRepeat() {
        return this.setRepeat(!this.repeatEnabled);
    }

    async unlockAudio() {
        this.audioUnlocked = true;
    }

    isAudioUnlocked() {
        return this.audioUnlocked;
    }

    getState() {
        return {
            currentTrack: this.currentTrack,
            isPlaying: !this.audio.paused,
            playbackRequested: this.playbackRequested,
            repeatEnabled: this.repeatEnabled,
            breakoutActive: false,
            loopCount: 0,
            currentTime: this.getCurrentTime(),
            duration: this.getDuration(),
            canLoop: Boolean(this.currentTrack),
            loopWindow: this.getLoopWindow(),
            isLoopingNow: this.repeatEnabled && this.shouldLoopCurrentMode(),
            transportKind: 'native'
        };
    }

    destroy() {
        this.removeEventListeners();
        this.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
    }

    normalizeSegments(track) {
        return normalizeSegments(track);
    }

    resolvePlaybackState(targetTime = 0) {
        return resolveSegmentPlaybackState({
            track: this.currentTrack,
            segmentConfig: this.getActiveSegmentConfig(),
            audioDuration: this.audio.duration,
            targetTime
        });
    }

    getActiveSegmentConfig() {
        return this.shouldUseSegmentedPlayback() ? this.segmentConfig : null;
    }

    async applyPlaybackState({ mode, src, offset, position }) {
        const absoluteSrc = new URL(src, window.location.href).href;
        this.pendingPlaybackPosition = Number.isFinite(position)
            ? position
            : this.getAbsolutePositionForMode(mode, offset);

        try {
            if (this.audio.src !== absoluteSrc) {
                await this.setSource(src);
            }

            this.currentMode = mode;
            this.audio.loop = this.shouldLoopCurrentMode();
            this.audio.currentTime = Math.max(offset, 0);
            this.clearPendingPlaybackPositionIfResolved();
            this.updateMediaSessionMetadata();
            this.updateMediaSessionPosition();
        } catch (error) {
            this.pendingPlaybackPosition = null;
            throw error;
        }
    }

    async setSource(src) {
        await new Promise((resolve, reject) => {
            const onLoaded = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error(`Failed to load audio source: ${src}`));
            };
            const cleanup = () => {
                this.audio.removeEventListener('loadedmetadata', onLoaded);
                this.audio.removeEventListener('error', onError);
            };

            this.audio.pause();
            this.audio.loop = false;
            this.audio.addEventListener('loadedmetadata', onLoaded, { once: true });
            this.audio.addEventListener('error', onError, { once: true });
            this.audio.src = src;
            this.audio.load();

            if (this.audio.readyState >= 1) {
                cleanup();
                resolve();
            }
        });
    }

    shouldLoopCurrentMode() {
        if (!this.repeatEnabled) {
            return false;
        }

        if (!this.getActiveSegmentConfig()) {
            return true;
        }

        return this.currentMode === 'loop';
    }

    shouldUseSegmentedPlayback() {
        if (!this.segmentConfig) {
            return false;
        }

        if (!this.preferFullTrackWhenRepeatDisabled) {
            return true;
        }

        return this.repeatEnabled;
    }

    getCurrentTime() {
        if (this.pendingPlaybackPosition !== null) {
            return this.pendingPlaybackPosition;
        }

        return this.getCurrentTimeFromAudio();
    }

    getCurrentTimeFromAudio() {
        if (!this.currentTrack) {
            return 0;
        }

        if (!this.segmentConfig || this.currentMode === 'full') {
            return this.audio.currentTime || 0;
        }

        if (this.currentMode === 'intro') {
            return this.audio.currentTime;
        }

        if (this.currentMode === 'loop') {
            return this.segmentConfig.loopStart + this.audio.currentTime;
        }

        return this.segmentConfig.loopEnd + this.audio.currentTime;
    }

    getAbsolutePositionForMode(mode, offset) {
        if (!this.segmentConfig || mode === 'full') {
            return Math.max(offset, 0);
        }

        if (mode === 'intro') {
            return Math.max(offset, 0);
        }

        if (mode === 'loop') {
            return this.segmentConfig.loopStart + Math.max(offset, 0);
        }

        return this.segmentConfig.loopEnd + Math.max(offset, 0);
    }

    clearPendingPlaybackPositionIfResolved() {
        if (this.pendingPlaybackPosition === null) {
            return;
        }

        const currentTime = this.getCurrentTimeFromAudio();
        if (Math.abs(currentTime - this.pendingPlaybackPosition) <= 0.25) {
            this.pendingPlaybackPosition = null;
        }
    }

    getDuration() {
        if (this.segmentConfig) {
            return this.segmentConfig.totalDuration;
        }

        return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    }

    getLoopWindow() {
        if (!this.segmentConfig) {
            return null;
        }

        return {
            start: this.segmentConfig.loopStart,
            end: this.segmentConfig.loopEnd
        };
    }

    async handleEnded() {
        if (await this.handleSegmentTransition()) {
            return;
        }

        this.updateMediaSession();
        this.emitProgress();
        this.emitState();
        this.onTrackEnded?.(this.getState());
    }

    async handleSegmentTransition() {
        if (!this.shouldUseSegmentedPlayback() || this.transitionInFlight) {
            return false;
        }

        if (this.currentMode === 'intro') {
            this.transitionInFlight = this.transitionToSegment('loop', 0);
            await this.transitionInFlight;
            this.transitionInFlight = null;
            return true;
        }

        if (this.currentMode === 'loop' && !this.repeatEnabled && this.segmentConfig.outroSrc) {
            this.transitionInFlight = this.transitionToSegment('outro', 0);
            await this.transitionInFlight;
            this.transitionInFlight = null;
            return true;
        }

        return false;
    }

    async transitionToSegment(mode, offset) {
        const srcMap = {
            loop: this.segmentConfig.loopSrc,
            outro: this.segmentConfig.outroSrc
        };

        await this.applyPlaybackState({
            mode,
            src: srcMap[mode],
            offset
        });
        await this.play();
    }

    handlePlaybackEvent() {
        if (!this.audio.paused) {
            this.audioUnlocked = true;
        }

        this.clearPendingPlaybackPositionIfResolved();
        this.updateMediaSession();
        this.emitProgress();
        this.emitState();
    }

    handleSeeked() {
        this.clearPendingPlaybackPositionIfResolved();
        this.updateMediaSessionPosition();
        this.emitProgress();
    }

    handleTimeUpdate() {
        this.clearPendingPlaybackPositionIfResolved();
        this.updateMediaSessionPosition();
        this.emitProgress();
    }

    handleLoadedMetadata() {
        this.clearPendingPlaybackPositionIfResolved();
        this.updateMediaSessionMetadata();
        this.updateMediaSessionPosition();
        this.emitProgress();
        this.emitState();
    }

    handleError() {
        this.emitState();
    }

    handlePageShow() {
        this.updateMediaSession();
        this.emitState();
    }

    handleVisibilityChange() {
        this.updateMediaSessionPosition();
    }

    emitProgress() {
        this.onProgress?.(this.getState());
    }

    emitState() {
        this.onStateChange?.(this.getState());
    }

    setupMediaSessionHandlers() {
        if (!('mediaSession' in navigator)) {
            return;
        }

        const handlers = {
            play: () => {
                void this.play();
            },
            pause: () => {
                this.pause();
            },
            previoustrack: () => {
                this.onPreviousTrack?.();
            },
            nexttrack: () => {
                this.onNextTrack?.();
            },
            seekto: (details) => {
                if (typeof details.seekTime === 'number') {
                    void this.seek(details.seekTime);
                }
            }
        };

        for (const [action, handler] of Object.entries(handlers)) {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (error) {
                continue;
            }
        }
    }

    updateMediaSessionMetadata() {
        if (!('mediaSession' in navigator) || typeof MediaMetadata !== 'function' || !this.currentTrack) {
            return;
        }

        navigator.mediaSession.metadata = new MediaMetadata(buildTrackMediaMetadata(this.currentTrack));
    }

    updateMediaSessionPosition() {
        if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') {
            return;
        }

        const duration = this.getDuration();
        if (!duration) {
            return;
        }

        try {
            navigator.mediaSession.setPositionState({
                duration,
                playbackRate: this.audio.playbackRate || 1,
                position: this.clamp(this.getCurrentTime(), 0, duration)
            });
        } catch (error) {
            return;
        }
    }

    updateMediaSession() {
        if (!('mediaSession' in navigator)) {
            return;
        }

        navigator.mediaSession.playbackState = this.audio.paused ? 'paused' : 'playing';
        this.updateMediaSessionMetadata();
        this.updateMediaSessionPosition();
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}
