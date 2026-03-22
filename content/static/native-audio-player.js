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
        enableMediaSession = true,
        preferFullTrackWhenRepeatDisabled = false,
        preferTrackNavigationControls = false,
        mediaSessionHandlerTiming = 'init',
        volume = 0.8,
        createPreloadAudio = null,
        maxPreloadedSources = 6
    } = {}) {
        if (!audioElement) {
            throw new Error('NativeAudioPlayer requires an audio element');
        }

        this.audio = audioElement;
        this.audio.preload = 'auto';
        this.audio.volume = volume;

        this.onStateChange = onStateChange;
        this.onProgress = onProgress;
        this.onTrackEnded = onTrackEnded;
        this.onPreviousTrack = onPreviousTrack;
        this.onNextTrack = onNextTrack;
        this.enableMediaSession = Boolean(enableMediaSession);
        this.preferFullTrackWhenRepeatDisabled = Boolean(preferFullTrackWhenRepeatDisabled);
        this.preferTrackNavigationControls = Boolean(preferTrackNavigationControls);
        this.mediaSessionHandlerTiming = mediaSessionHandlerTiming;

        this.currentTrack = null;
        this.repeatEnabled = false;
        this.audioUnlocked = false;
        this.segmentConfig = null;
        this.currentMode = 'full';
        this.transitionInFlight = null;
        this.pendingPlaybackPosition = null;
        this._sourceTransitionActive = false;
        this.playbackRequested = false;
        this.errorReason = null;
        this.createPreloadAudio = createPreloadAudio ?? (() => new Audio());
        this.maxPreloadedSources = Math.max(Number(maxPreloadedSources) || 0, 1);
        this.preloadEntries = new Map();

        this.boundOnPlay = this.handlePlaybackEvent.bind(this);
        this.boundOnPlaying = this.handlePlaying.bind(this);
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
        if (this.shouldRegisterMediaSessionHandlersOnInit()) {
            this.setupMediaSessionHandlers();
        }
    }

    attachEventListeners() {
        this.audio.addEventListener('play', this.boundOnPlay);
        this.audio.addEventListener('playing', this.boundOnPlaying);
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
        this.audio.removeEventListener('playing', this.boundOnPlaying);
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
        this.clearError({ emitState: false });

        try {
            const nextState = this.resolvePlaybackState(startTime);
            await this.applyPlaybackState(nextState);

            if (autoplay) {
                await this.play();
            } else {
                this.emitProgress();
                this.emitState();
            }

            return true;
        } catch (error) {
            this.playbackRequested = false;
            this.setError(error, { emitState: true });
            throw error;
        }
    }

    async preloadTrack(track) {
        if (!track?.src) {
            return null;
        }

        const sources = this.getPreloadSources(track);
        const requestedKeys = new Set(sources.map((src) => this.getAbsoluteSourceUrl(src)));
        this.prunePreloadEntries(requestedKeys);

        const preloadPromises = sources.map((src) => this.preloadSource(src));
        return Promise.all(preloadPromises);
    }

    shouldExposeSeekControls() {
        return !this.preferTrackNavigationControls;
    }

    shouldRegisterMediaSessionHandlersOnInit() {
        if (!this.enableMediaSession) {
            return false;
        }

        return this.mediaSessionHandlerTiming === 'init' || this.mediaSessionHandlerTiming === 'both';
    }

    shouldRegisterMediaSessionHandlersOnPlaying() {
        if (!this.enableMediaSession) {
            return false;
        }

        return this.mediaSessionHandlerTiming === 'playing' || this.mediaSessionHandlerTiming === 'both';
    }

    async play() {
        if (!this.currentTrack) {
            return;
        }

        this.playbackRequested = true;

        try {
            await this.audio.play();
            this.audioUnlocked = true;
            this.clearError({ emitState: false });
            this.updateMediaSession();
            this.emitState();
        } catch (error) {
            this.playbackRequested = false;
            this.setError(error, { emitState: false });
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
        this.clearError({ emitState: false });

        try {
            const nextState = this.resolvePlaybackState(seconds);
            await this.applyPlaybackState(nextState);

            if (wasPlaying) {
                await this.play();
            } else {
                this.emitProgress();
                this.emitState();
            }
        } catch (error) {
            this.playbackRequested = false;
            this.setError(error, { emitState: true });
            throw error;
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
            hasError: Boolean(this.errorReason),
            errorReason: this.errorReason,
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
        this.clearPreloadEntries();
        this.audio.removeAttribute('src');
        this.audio.load();
    }

    clearError({ emitState = true } = {}) {
        if (!this.errorReason) {
            return;
        }

        this.errorReason = null;
        if (emitState) {
            this.emitState();
        }
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
            this.clearError({ emitState: false });
            this.clearPendingPlaybackPositionIfResolved();
            this.updateMediaSessionMetadata();
            this.updateMediaSessionPosition();
        } catch (error) {
            this.pendingPlaybackPosition = null;
            throw error;
        }
    }

    async setSource(src) {
        this._sourceTransitionActive = true;
        try {
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

                // this.audio.pause();
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
        } finally {
            this._sourceTransitionActive = false;
        }
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

    getPreloadSources(track) {
        const sources = new Set();
        const segmentConfig = this.normalizeSegments(track);

        if (track?.src) {
            sources.add(track.src);
        }

        if (segmentConfig?.introSrc) {
            sources.add(segmentConfig.introSrc);
        }

        if (segmentConfig?.loopSrc) {
            sources.add(segmentConfig.loopSrc);
        }

        if (segmentConfig?.outroSrc) {
            sources.add(segmentConfig.outroSrc);
        }

        return [...sources];
    }

    getAbsoluteSourceUrl(src) {
        return new URL(src, window.location.href).href;
    }

    preloadSource(src) {
        const key = this.getAbsoluteSourceUrl(src);
        const existingEntry = this.preloadEntries.get(key);

        if (existingEntry) {
            this.preloadEntries.delete(key);
            this.preloadEntries.set(key, existingEntry);
            return existingEntry.promise;
        }

        const preloadAudio = this.createPreloadAudio();
        preloadAudio.preload = 'auto';

        const promise = new Promise((resolve, reject) => {
            const onLoaded = () => {
                cleanup();
                resolve(preloadAudio);
            };
            const onError = () => {
                cleanup();
                reject(new Error(`Failed to preload audio source: ${src}`));
            };
            const cleanup = () => {
                preloadAudio.removeEventListener('loadeddata', onLoaded);
                preloadAudio.removeEventListener('canplaythrough', onLoaded);
                preloadAudio.removeEventListener('error', onError);
            };

            preloadAudio.addEventListener('loadeddata', onLoaded, { once: true });
            preloadAudio.addEventListener('canplaythrough', onLoaded, { once: true });
            preloadAudio.addEventListener('error', onError, { once: true });
            preloadAudio.src = src;
            preloadAudio.load();

            if (preloadAudio.readyState >= 2) {
                cleanup();
                resolve(preloadAudio);
            }
        });

        this.preloadEntries.set(key, {
            audio: preloadAudio,
            promise
        });
        this.prunePreloadEntries();

        return promise;
    }

    prunePreloadEntries(retainKeys = null) {
        for (const [key, entry] of this.preloadEntries) {
            if (retainKeys?.has(key)) {
                continue;
            }

            if (retainKeys) {
                this.releasePreloadEntry(entry);
                this.preloadEntries.delete(key);
            }
        }

        while (this.preloadEntries.size > this.maxPreloadedSources) {
            const oldestKey = this.preloadEntries.keys().next().value;
            const oldestEntry = this.preloadEntries.get(oldestKey);
            this.releasePreloadEntry(oldestEntry);
            this.preloadEntries.delete(oldestKey);
        }
    }

    clearPreloadEntries() {
        for (const entry of this.preloadEntries.values()) {
            this.releasePreloadEntry(entry);
        }

        this.preloadEntries.clear();
    }

    releasePreloadEntry(entry) {
        entry?.audio?.pause?.();
        entry?.audio?.removeAttribute?.('src');
        entry?.audio?.load?.();
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
        try {
            if (await this.handleSegmentTransition()) {
                return;
            }
        } catch (error) {
            this.playbackRequested = false;
            this.setError(error, { emitState: true });
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
            this.clearError({ emitState: false });
        }

        if (this._sourceTransitionActive) {
            return;
        }

        this.clearPendingPlaybackPositionIfResolved();
        this.updateMediaSession();
        this.emitProgress();
        this.emitState();
    }

    handlePlaying() {
        if (!this.shouldRegisterMediaSessionHandlersOnPlaying()) {
            return;
        }

        this.setupMediaSessionHandlers();
        this.updateMediaSession();
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
        this.clearError({ emitState: false });
        this.clearPendingPlaybackPositionIfResolved();

        if (this._sourceTransitionActive) {
            return;
        }

        this.updateMediaSessionMetadata();
        this.updateMediaSessionPosition();
        this.emitProgress();
        this.emitState();
    }

    handleError() {
        this.playbackRequested = false;
        this.setError(this.createAudioError());
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
        if (!this.enableMediaSession || !('mediaSession' in navigator)) {
            return;
        }

        const seekActions = ['seekbackward', 'seekforward'];

        if (!this.shouldExposeSeekControls()) {
            for (const action of seekActions) {
                try {
                    navigator.mediaSession.setActionHandler(action, null);
                } catch (error) {
                    continue;
                }
            }
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
        if (!this.enableMediaSession || !('mediaSession' in navigator) || typeof MediaMetadata !== 'function' || !this.currentTrack) {
            return;
        }

        navigator.mediaSession.metadata = new MediaMetadata(buildTrackMediaMetadata(this.currentTrack));
    }

    updateMediaSessionPosition() {
        if (!this.enableMediaSession || !('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') {
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
        if (!this.enableMediaSession || !('mediaSession' in navigator)) {
            return;
        }

        navigator.mediaSession.playbackState = this.audio.paused ? 'paused' : 'playing';
        this.updateMediaSessionMetadata();
        this.updateMediaSessionPosition();
    }

    setError(error, { emitState = true } = {}) {
        this.errorReason = error instanceof Error
            ? error.message
            : typeof error === 'string'
                ? error
                : 'Audio playback failed';

        if (emitState) {
            this.emitState();
        }
    }

    createAudioError() {
        const mediaError = this.audio?.error;
        if (!mediaError?.code) {
            return new Error('Audio playback failed');
        }

        const errorMessages = {
            1: 'Audio playback was aborted',
            2: 'Audio playback failed due to a network error',
            3: 'Audio playback failed while decoding the track',
            4: 'Audio playback failed because the track format is unsupported'
        };

        return new Error(errorMessages[mediaError.code] ?? 'Audio playback failed');
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}
