import { normalizeSegments, resolvePlaybackState } from './native-audio-player-logic.js';
import { mediaMetadata } from './player-data.js';

export class SegmentPlayer {
    constructor({
        audioElement,
        enableMediaSession = false,
        onStateChange,
        onProgress,
        onTrackEnded,
        onPreviousTrack,
        onNextTrack,
        volume = 0.8,
        maxRepeats = 10,
        maxPlaybackMinutes = 30
    } = {}) {
        this.audioElement = audioElement ?? null;
        this.enableMediaSession = enableMediaSession;
        this.onStateChange = onStateChange;
        this.onProgress = onProgress;
        this.onTrackEnded = onTrackEnded;
        this.onPreviousTrack = onPreviousTrack;
        this.onNextTrack = onNextTrack;
        this.volume = volume;
        this.maxRepeats = maxRepeats;
        this.maxPlaybackSeconds = maxPlaybackMinutes * 60;

        this.audioContext = null;
        this.gainNode = null;
        this.audioUnlocked = false;
        this.bufferCache = new Map();
        this.bufferLoadPromises = new Map();
        this.trackLoadRequestId = 0;

        this.currentTrack = null;
        this.segmentConfig = null;
        this.segmentBuffers = { intro: null, loop: null, outro: null };
        this.fullBuffer = null;

        this.currentSource = null;
        this.scheduledSource = null;
        this.currentMode = 'full';
        this.scheduledMode = null;

        this.isPlaying = false;
        this.repeatEnabled = false;
        this.loopCount = 0;
        this.breakoutActive = false;

        this.lastKnownTime = 0;
        this.sourceStartContextTime = 0;
        this.sourceStartOffset = 0;
        this.loopExitBoundaryContextTime = null;
        this.loopPlaybackActive = false;

        this.activePlaybackSeconds = 0;
        this.activePlaybackStartedAt = null;

        this.progressFrame = null;
        this.preBoundaryTimer = null;
        this.boundaryTimer = null;
        this.transitionTimer = null;

        this.boundOnVisibilityChange = this.handleVisibilityChange.bind(this);
        this.boundOnPageShow = this.handlePageShow.bind(this);
        document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
        window.addEventListener('pageshow', this.boundOnPageShow);

        if (this.enableMediaSession) {
            this.setupMediaSessionHandlers();
        }
    }

    // ── Track loading ──────────────────────────────────────────────

    async loadTrack(track, { autoplay = false, startTime = 0 } = {}) {
        const requestId = ++this.trackLoadRequestId;
        this.stopAllSources();
        this.stopProgressUpdates();

        this.currentTrack = track;
        this.segmentConfig = null;
        this.segmentBuffers = { intro: null, loop: null, outro: null };
        this.fullBuffer = null;
        this.currentMode = 'full';
        this.scheduledMode = null;
        this.lastKnownTime = 0;
        this.loopCount = 0;
        this.breakoutActive = false;
        this.loopExitBoundaryContextTime = null;
        this.loopPlaybackActive = false;
        this.activePlaybackSeconds = 0;
        this.activePlaybackStartedAt = null;
        this.isPlaying = false;

        this.emitProgress();
        this.emitState();

        const config = normalizeSegments(track);

        if (config) {
            this.segmentConfig = config;
            const bufferPromises = [
                config.introSrc ? this.loadBuffer(config.introSrc, { priority: 'high' }) : Promise.resolve(null),
                this.loadBuffer(config.loopSrc, { priority: 'high' }),
                config.outroSrc ? this.loadBuffer(config.outroSrc, { priority: 'high' }) : Promise.resolve(null)
            ];

            const [intro, loop, outro] = await Promise.all(bufferPromises);
            if (requestId !== this.trackLoadRequestId) {
                return false;
            }

            this.segmentBuffers = { intro, loop, outro };
        } else {
            const buffer = await this.loadBuffer(track.src, { priority: 'high' });
            if (requestId !== this.trackLoadRequestId) {
                return false;
            }

            this.fullBuffer = buffer;
        }

        const clampedStart = this.clamp(startTime, 0, this.getDuration());
        this.lastKnownTime = clampedStart;

        this.emitProgress();
        this.emitState();

        if (autoplay) {
            await this.play();
        }

        return true;
    }

    async preloadTrack(track, { priority = 'low' } = {}) {
        if (!track?.src) {
            return null;
        }

        const config = normalizeSegments(track);
        if (config) {
            const promises = [
                config.introSrc ? this.loadBuffer(config.introSrc, { priority }) : Promise.resolve(null),
                this.loadBuffer(config.loopSrc, { priority }),
                config.outroSrc ? this.loadBuffer(config.outroSrc, { priority }) : Promise.resolve(null)
            ];
            return Promise.all(promises);
        }

        return this.loadBuffer(track.src, { priority });
    }

    // ── Playback controls ──────────────────────────────────────────

    async play() {
        if (!this.currentTrack) {
            return;
        }

        await this.unlockAudio();

        if (this.isPlaying) {
            return;
        }

        this.startPlaybackAt(this.lastKnownTime);
        this.isPlaying = true;
        this.activePlaybackStartedAt = this.audioContext.currentTime;
        this.startProgressUpdates();
        this.startKeepalive();
        this.updateMediaSession();
        this.emitState();
    }

    pause() {
        if (!this.isPlaying) {
            return;
        }

        this.lastKnownTime = this.getCurrentTime();
        this.activePlaybackSeconds = this.getActivePlaybackSeconds();
        this.activePlaybackStartedAt = null;
        this.isPlaying = false;

        this.stopAllSources();
        this.stopProgressUpdates();
        this.stopKeepalive();
        this.updateMediaSession();
        this.emitProgress();
        this.emitState();
    }

    async seek(seconds) {
        if (!this.currentTrack) {
            return;
        }

        const duration = this.getDuration();
        const nextTime = this.clamp(seconds, 0, duration);
        this.lastKnownTime = nextTime;

        if (!this.isPlaying) {
            this.emitProgress();
            this.emitState();
            return;
        }

        const elapsedBeforeSeek = this.getActivePlaybackSeconds();
        this.stopAllSources();
        this.activePlaybackSeconds = elapsedBeforeSeek;
        this.activePlaybackStartedAt = this.audioContext.currentTime;
        this.startPlaybackAt(nextTime);
        this.updateMediaSessionPosition();
        this.emitProgress();
        this.emitState();
    }

    async setRepeat(enabled) {
        const nextValue = Boolean(enabled);
        if (this.repeatEnabled === nextValue) {
            return;
        }

        this.repeatEnabled = nextValue;

        if (!this.isPlaying) {
            this.emitState();
            return;
        }

        if (!nextValue && this.currentSource?.loop && this.loopExitBoundaryContextTime === null) {
            this.disableLoopAtNextBoundary(false);
            this.emitState();
            return;
        }

        if (nextValue && this.currentMode === 'loop' && !this.currentSource?.loop) {
            const currentTime = this.getCurrentTime();
            const elapsed = this.getActivePlaybackSeconds();
            this.stopAllSources();
            this.activePlaybackSeconds = elapsed;
            this.activePlaybackStartedAt = this.audioContext.currentTime;
            this.startPlaybackAt(currentTime);
        }

        this.emitState();
    }

    toggleRepeat() {
        return this.setRepeat(!this.repeatEnabled);
    }

    // ── State ──────────────────────────────────────────────────────

    getState() {
        return {
            currentTrack: this.currentTrack,
            isPlaying: this.isPlaying,
            repeatEnabled: this.repeatEnabled,
            breakoutActive: this.breakoutActive,
            loopCount: this.loopCount,
            currentTime: this.getCurrentTime(),
            duration: this.getDuration(),
            canLoop: this.hasLoopWindow(),
            loopWindow: this.getLoopWindow(),
            isLoopingNow: this.loopPlaybackActive && this.loopExitBoundaryContextTime === null,
            transportKind: 'segment'
        };
    }

    isAudioUnlocked() {
        return this.audioUnlocked;
    }

    destroy() {
        this.stopAllSources();
        this.stopProgressUpdates();
        this.stopKeepalive();
        document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
        window.removeEventListener('pageshow', this.boundOnPageShow);
        if (this.audioContext?.state !== 'closed') {
            this.audioContext?.close();
        }
        this.audioContext = null;
        this.gainNode = null;
        this.bufferCache.clear();
        this.bufferLoadPromises.clear();
    }

    // ── AudioContext management ─────────────────────────────────────

    async ensureAudioContext() {
        if (this.audioContext) {
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            throw new Error('Web Audio is not supported in this browser');
        }

        this.audioContext = new AudioContextClass();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.audioContext.destination);
    }

    async unlockAudio() {
        await this.ensureAudioContext();

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        if (this.audioUnlocked) {
            return;
        }

        const unlockBuffer = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate);
        const unlockSource = this.audioContext.createBufferSource();
        unlockSource.buffer = unlockBuffer;
        unlockSource.connect(this.gainNode);
        unlockSource.start(0);

        window.setTimeout(() => {
            unlockSource.disconnect();
        }, 0);

        this.audioUnlocked = true;
    }

    // ── Buffer loading ─────────────────────────────────────────────

    async loadBuffer(src, { priority = 'auto' } = {}) {
        if (this.bufferCache.has(src)) {
            return this.bufferCache.get(src);
        }

        if (this.bufferLoadPromises.has(src)) {
            return this.bufferLoadPromises.get(src);
        }

        const loadPromise = (async () => {
            await this.ensureAudioContext();

            const requestOptions = {};
            if (priority !== 'auto') {
                requestOptions.priority = priority;
            }

            const response = await fetch(src, requestOptions);
            if (!response.ok) {
                throw new Error(`Failed to fetch audio: ${src}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const decoded = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
            this.bufferCache.set(src, decoded);
            return decoded;
        })();

        this.bufferLoadPromises.set(src, loadPromise);

        try {
            return await loadPromise;
        } finally {
            this.bufferLoadPromises.delete(src);
        }
    }

    // ── Playback engine ────────────────────────────────────────────

    startPlaybackAt(absoluteTime) {
        if (this.segmentConfig) {
            this.startSegmentedPlayback(absoluteTime);
        } else if (this.fullBuffer) {
            this.startFullBufferPlayback(absoluteTime);
        }
    }

    startFullBufferPlayback(offset) {
        const buffer = this.fullBuffer;
        const clampedOffset = this.clamp(offset, 0, buffer.duration);
        const source = this.createSource(buffer);

        const loop = this.currentTrack?.loop;
        const shouldLoop = this.repeatEnabled && loop &&
            Number.isFinite(loop.start) && Number.isFinite(loop.end) &&
            loop.end > loop.start && clampedOffset < loop.end;

        if (shouldLoop) {
            source.loop = true;
            source.loopStart = loop.start;
            source.loopEnd = loop.end;
        }

        source.onended = () => this.handleSourceEnded(source, 'full');

        this.currentSource = source;
        this.currentMode = 'full';
        this.sourceStartContextTime = this.audioContext.currentTime;
        this.sourceStartOffset = clampedOffset;
        this.lastKnownTime = clampedOffset;
        this.loopExitBoundaryContextTime = null;
        this.loopPlaybackActive = shouldLoop;

        source.start(0, clampedOffset);

        if (source.loop) {
            this.scheduleBoundaryTimers();
        }
    }

    startSegmentedPlayback(absoluteTime) {
        const state = resolvePlaybackState({
            track: this.currentTrack,
            segmentConfig: this.segmentConfig,
            targetTime: absoluteTime
        });

        this.startSegmentSource(state.mode, state.offset);
    }

    startSegmentSource(mode, offset) {
        const buffer = this.getBufferForMode(mode);
        if (!buffer) {
            return;
        }

        const clampedOffset = this.clamp(offset, 0, buffer.duration);
        const source = this.createSource(buffer);

        const shouldLoop = mode === 'loop' && this.shouldUseLooping();
        if (shouldLoop) {
            source.loop = true;
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
        }

        source.onended = () => this.handleSegmentSourceEnded(source, mode);

        this.currentSource = source;
        this.currentMode = mode;
        this.sourceStartContextTime = this.audioContext.currentTime;
        this.sourceStartOffset = clampedOffset;
        this.lastKnownTime = this.absoluteTimeForMode(mode, clampedOffset);
        this.loopExitBoundaryContextTime = null;
        this.loopPlaybackActive = shouldLoop;

        source.start(0, clampedOffset);

        if (mode === 'intro') {
            this.scheduleNextSegment(mode, buffer.duration - clampedOffset);
        }

        if (shouldLoop) {
            this.scheduleBoundaryTimers();
        }
    }

    scheduleNextSegment(currentMode, secondsUntilEnd) {
        this.clearTransitionTimer();

        if (currentMode === 'intro') {
            const loopBuffer = this.segmentBuffers.loop;
            if (!loopBuffer) {
                return;
            }

            const when = this.audioContext.currentTime + secondsUntilEnd;
            const nextSource = this.createSource(loopBuffer);

            const shouldLoop = this.shouldUseLooping();
            if (shouldLoop) {
                nextSource.loop = true;
                nextSource.loopStart = 0;
                nextSource.loopEnd = loopBuffer.duration;
            }

            nextSource.onended = () => this.handleSegmentSourceEnded(nextSource, 'loop');
            nextSource.start(when);

            this.scheduledSource = nextSource;
            this.scheduledMode = 'loop';

            this.transitionTimer = window.setTimeout(() => {
                this.commitScheduledTransition(when);
            }, secondsUntilEnd * 1000);
        }
    }

    commitScheduledTransition(transitionContextTime) {
        this.transitionTimer = null;

        if (!this.scheduledSource) {
            return;
        }

        const prevSource = this.currentSource;
        this.currentSource = this.scheduledSource;
        this.currentMode = this.scheduledMode;
        this.scheduledSource = null;
        this.scheduledMode = null;

        this.sourceStartContextTime = transitionContextTime;
        this.sourceStartOffset = 0;

        const shouldLoop = this.currentMode === 'loop' && this.currentSource.loop;
        this.loopPlaybackActive = shouldLoop;
        this.loopExitBoundaryContextTime = null;

        if (prevSource) {
            prevSource.onended = null;
            try { prevSource.stop(); } catch (_) { /* already stopped */ }
            prevSource.disconnect();
        }

        if (shouldLoop) {
            this.scheduleBoundaryTimers();
        }

        this.emitProgress();
        this.emitState();
    }

    scheduleOutroTransition(loopExitContextTime) {
        const outroBuffer = this.segmentBuffers.outro;
        if (!outroBuffer) {
            return;
        }

        const outroSource = this.createSource(outroBuffer);
        outroSource.onended = () => this.handleSegmentSourceEnded(outroSource, 'outro');
        outroSource.start(loopExitContextTime);

        this.scheduledSource = outroSource;
        this.scheduledMode = 'outro';

        const delay = Math.max(0, loopExitContextTime - this.audioContext.currentTime);
        this.transitionTimer = window.setTimeout(() => {
            this.commitScheduledTransition(loopExitContextTime);
        }, delay * 1000);
    }

    // ── Source lifecycle ────────────────────────────────────────────

    createSource(buffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode);
        return source;
    }

    stopAllSources() {
        this.clearBoundaryTimers();
        this.clearTransitionTimer();

        if (this.scheduledSource) {
            const scheduled = this.scheduledSource;
            this.scheduledSource = null;
            this.scheduledMode = null;
            scheduled.onended = null;
            try { scheduled.stop(); } catch (_) { /* */ }
            scheduled.disconnect();
        }

        if (this.currentSource) {
            const source = this.currentSource;
            this.currentSource = null;
            this.loopPlaybackActive = false;
            source.onended = null;
            try { source.stop(); } catch (_) { /* */ }
            source.disconnect();
        }
    }

    handleSourceEnded(source, mode) {
        if (source !== this.currentSource) {
            return;
        }

        this.clearBoundaryTimers();
        this.stopProgressUpdates();
        source.disconnect();
        this.currentSource = null;
        this.loopPlaybackActive = false;
        this.lastKnownTime = this.getDuration();

        if (!this.isPlaying) {
            this.emitProgress();
            this.emitState();
            return;
        }

        this.activePlaybackSeconds = this.getActivePlaybackSeconds();
        this.activePlaybackStartedAt = null;
        this.isPlaying = false;
        this.stopKeepalive();

        this.updateMediaSession();
        this.emitProgress();
        this.emitState();
        this.onTrackEnded?.(this.getState());
    }

    handleSegmentSourceEnded(source, mode) {
        if (source !== this.currentSource) {
            return;
        }

        if (mode === 'intro' && this.scheduledSource) {
            return;
        }

        if (mode === 'loop' && this.scheduledSource) {
            return;
        }

        if (mode === 'loop' && !this.repeatEnabled && !this.segmentConfig?.outroSrc) {
            this.finishPlayback();
            return;
        }

        if (mode === 'loop' && !this.repeatEnabled && this.segmentConfig?.outroSrc && !this.scheduledSource) {
            this.clearBoundaryTimers();
            source.disconnect();
            this.currentSource = null;
            this.loopPlaybackActive = false;

            const outroBuffer = this.segmentBuffers.outro;
            if (outroBuffer) {
                this.startSegmentSource('outro', 0);
            } else {
                this.finishPlayback();
            }
            return;
        }

        if (mode === 'outro') {
            this.finishPlayback();
            return;
        }

        this.finishPlayback();
    }

    finishPlayback() {
        this.clearBoundaryTimers();
        this.stopProgressUpdates();

        if (this.currentSource) {
            this.currentSource.disconnect();
            this.currentSource = null;
        }
        this.loopPlaybackActive = false;
        this.lastKnownTime = this.getDuration();

        if (!this.isPlaying) {
            this.emitProgress();
            this.emitState();
            return;
        }

        this.activePlaybackSeconds = this.getActivePlaybackSeconds();
        this.activePlaybackStartedAt = null;
        this.isPlaying = false;
        this.stopKeepalive();

        this.updateMediaSession();
        this.emitProgress();
        this.emitState();
        this.onTrackEnded?.(this.getState());
    }

    // ── Loop boundary management ───────────────────────────────────

    shouldUseLooping() {
        return Boolean(
            this.repeatEnabled &&
            !this.breakoutActive &&
            this.loopCount < this.maxRepeats &&
            this.getActivePlaybackSeconds() < this.maxPlaybackSeconds
        );
    }

    scheduleBoundaryTimers() {
        this.clearBoundaryTimers();
        if (!this.currentSource?.loop) {
            return;
        }

        const secondsUntilBoundary = this.getSecondsUntilNextBoundary();
        const preBoundarySeconds = Math.max(0, secondsUntilBoundary - 0.05);

        this.preBoundaryTimer = window.setTimeout(() => {
            this.evaluateBoundaryDecision();
        }, preBoundarySeconds * 1000);

        this.boundaryTimer = window.setTimeout(() => {
            this.handleBoundaryCrossed();
        }, secondsUntilBoundary * 1000);
    }

    evaluateBoundaryDecision() {
        if (!this.currentSource?.loop || this.loopExitBoundaryContextTime !== null) {
            return;
        }

        const projectedActivePlayback = this.getActivePlaybackSeconds() + this.getSecondsUntilNextBoundary();
        const projectedLoopCount = this.loopCount + 1;
        const shouldBreak = (
            projectedLoopCount > this.maxRepeats ||
            projectedActivePlayback >= this.maxPlaybackSeconds
        );

        if (shouldBreak) {
            this.breakoutActive = true;
            this.disableLoopAtNextBoundary(true);
            this.emitState();
        }
    }

    disableLoopAtNextBoundary(markBreakout) {
        if (!this.currentSource?.loop || this.loopExitBoundaryContextTime !== null) {
            return;
        }

        const secondsUntilBoundary = this.getSecondsUntilNextBoundary();
        const exitTime = this.audioContext.currentTime + secondsUntilBoundary;
        this.loopExitBoundaryContextTime = exitTime;
        this.currentSource.loop = false;

        if (markBreakout) {
            this.breakoutActive = true;
        }

        window.clearTimeout(this.preBoundaryTimer);
        this.preBoundaryTimer = null;

        if (this.segmentConfig?.outroSrc && this.segmentBuffers.outro) {
            this.scheduleOutroTransition(exitTime);
        }
    }

    handleBoundaryCrossed() {
        if (this.loopExitBoundaryContextTime !== null) {
            this.clearBoundaryTimers();
            this.emitState();
            return;
        }

        this.loopCount += 1;
        this.emitState();
        this.scheduleBoundaryTimers();
    }

    getSecondsUntilNextBoundary() {
        if (this.segmentConfig) {
            const loopBuffer = this.segmentBuffers.loop;
            if (!loopBuffer) {
                return 0;
            }

            const elapsed = Math.max(0, this.audioContext.currentTime - this.sourceStartContextTime);
            const positionInLoop = this.sourceStartOffset + elapsed;
            const loopDuration = loopBuffer.duration;
            const progress = this.getLoopProgress(positionInLoop, loopDuration);
            return loopDuration - progress;
        }

        const loop = this.currentTrack?.loop;
        if (!loop) {
            return 0;
        }

        const currentTime = this.getCurrentTime();
        if (currentTime < loop.end) {
            return loop.end - currentTime;
        }

        return loop.end - loop.start;
    }

    // ── Time tracking ──────────────────────────────────────────────

    getCurrentTime() {
        if (!this.currentTrack) {
            return 0;
        }

        if (!this.currentSource || !this.isPlaying) {
            return this.lastKnownTime;
        }

        const elapsed = Math.max(0, this.audioContext.currentTime - this.sourceStartContextTime);

        if (this.segmentConfig) {
            return this.getSegmentedCurrentTime(elapsed);
        }

        return this.getFullBufferCurrentTime(elapsed);
    }

    getSegmentedCurrentTime(elapsed) {
        if (this.currentMode === 'intro') {
            return this.clamp(this.sourceStartOffset + elapsed, 0, this.segmentConfig.introEnd);
        }

        if (this.currentMode === 'outro') {
            return this.clamp(
                this.segmentConfig.loopEnd + this.sourceStartOffset + elapsed,
                this.segmentConfig.loopEnd,
                this.segmentConfig.totalDuration
            );
        }

        // Loop mode
        const loopBuffer = this.segmentBuffers.loop;
        if (!loopBuffer) {
            return this.segmentConfig.loopStart;
        }

        if (!this.loopPlaybackActive) {
            return this.clamp(
                this.segmentConfig.loopStart + this.sourceStartOffset + elapsed,
                this.segmentConfig.loopStart,
                this.segmentConfig.loopEnd
            );
        }

        if (this.loopExitBoundaryContextTime !== null) {
            const elapsedSinceExit = this.audioContext.currentTime - this.loopExitBoundaryContextTime;
            if (elapsedSinceExit >= 0) {
                return this.clamp(
                    this.segmentConfig.loopEnd + elapsedSinceExit,
                    this.segmentConfig.loopEnd,
                    this.segmentConfig.totalDuration
                );
            }
        }

        const positionInBuffer = this.sourceStartOffset + elapsed;
        const loopDuration = loopBuffer.duration;

        const loopProgress = this.getLoopProgress(positionInBuffer, loopDuration);
        return this.segmentConfig.loopStart + loopProgress;
    }

    getFullBufferCurrentTime(elapsed) {
        const buffer = this.fullBuffer;
        if (!buffer) {
            return 0;
        }

        if (!this.loopPlaybackActive) {
            return this.clamp(this.sourceStartOffset + elapsed, 0, buffer.duration);
        }

        const loop = this.currentTrack?.loop;
        if (!loop) {
            return this.clamp(this.sourceStartOffset + elapsed, 0, buffer.duration);
        }

        if (this.loopExitBoundaryContextTime !== null) {
            const elapsedSinceExit = this.audioContext.currentTime - this.loopExitBoundaryContextTime;
            if (elapsedSinceExit >= 0) {
                return this.clamp(loop.end + elapsedSinceExit, 0, buffer.duration);
            }
        }

        const timeUntilLoopBoundary = loop.end - this.sourceStartOffset;
        if (elapsed < timeUntilLoopBoundary) {
            return this.clamp(this.sourceStartOffset + elapsed, 0, buffer.duration);
        }

        const loopDuration = loop.end - loop.start;
        const loopElapsed = elapsed - timeUntilLoopBoundary;
        const loopProgress = ((loopElapsed % loopDuration) + loopDuration) % loopDuration;
        return this.clamp(loop.start + loopProgress, loop.start, loop.end);
    }

    getDuration() {
        if (this.segmentConfig) {
            return this.segmentConfig.totalDuration;
        }

        return this.fullBuffer?.duration ?? 0;
    }

    hasLoopWindow() {
        if (this.segmentConfig) {
            return true;
        }

        const loop = this.currentTrack?.loop;
        return Boolean(loop && Number.isFinite(loop.start) && Number.isFinite(loop.end) && loop.end > loop.start);
    }

    getLoopWindow() {
        if (this.segmentConfig) {
            return {
                start: this.segmentConfig.loopStart,
                end: this.segmentConfig.loopEnd
            };
        }

        const loop = this.currentTrack?.loop;
        if (!loop || !Number.isFinite(loop.start) || !Number.isFinite(loop.end)) {
            return null;
        }

        return { start: loop.start, end: loop.end };
    }

    absoluteTimeForMode(mode, offset) {
        if (!this.segmentConfig) {
            return offset;
        }

        if (mode === 'intro') {
            return offset;
        }

        if (mode === 'loop') {
            return this.segmentConfig.loopStart + offset;
        }

        return this.segmentConfig.loopEnd + offset;
    }

    getLoopProgress(positionInBuffer, loopDuration) {
        if (!(loopDuration > 0)) {
            return 0;
        }

        return ((positionInBuffer % loopDuration) + loopDuration) % loopDuration;
    }

    getBufferForMode(mode) {
        if (mode === 'intro') {
            return this.segmentBuffers.intro;
        }

        if (mode === 'loop') {
            return this.segmentBuffers.loop;
        }

        if (mode === 'outro') {
            return this.segmentBuffers.outro;
        }

        return this.fullBuffer;
    }

    getActivePlaybackSeconds() {
        if (!this.isPlaying || this.activePlaybackStartedAt === null) {
            return this.activePlaybackSeconds;
        }

        return this.activePlaybackSeconds + (this.audioContext.currentTime - this.activePlaybackStartedAt);
    }

    // ── iOS keepalive ──────────────────────────────────────────────

    startKeepalive() {
        if (!this.audioElement || !this.enableMediaSession) {
            return;
        }

        if (this.audioElement.paused) {
            this.audioElement.loop = true;
            this.audioElement.volume = 0;

            if (!this.audioElement.src || this.audioElement.src === window.location.href) {
                this.setKeepaliveSrc();
            }

            this.audioElement.play().catch(() => {});
        }
    }

    stopKeepalive() {
        if (!this.audioElement) {
            return;
        }

        this.audioElement.pause();
    }

    setKeepaliveSrc() {
        // Tiny silent WAV as data URI (44 bytes of silence)
        this.audioElement.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    }

    // ── Progress updates ───────────────────────────────────────────

    startProgressUpdates() {
        this.stopProgressUpdates();

        const tick = () => {
            if (!this.isPlaying) {
                this.progressFrame = null;
                return;
            }

            this.emitProgress();
            this.progressFrame = window.requestAnimationFrame(tick);
        };

        this.progressFrame = window.requestAnimationFrame(tick);
    }

    stopProgressUpdates() {
        if (this.progressFrame !== null) {
            window.cancelAnimationFrame(this.progressFrame);
            this.progressFrame = null;
        }
    }

    // ── Media Session ──────────────────────────────────────────────

    setupMediaSessionHandlers() {
        if (!('mediaSession' in navigator)) {
            return;
        }

        const handlers = {
            play: () => { void this.play(); },
            pause: () => { this.pause(); },
            previoustrack: () => { this.onPreviousTrack?.(); },
            nexttrack: () => { this.onNextTrack?.(); },
            seekto: (details) => {
                if (typeof details.seekTime === 'number') {
                    void this.seek(details.seekTime);
                }
            }
        };

        for (const [action, handler] of Object.entries(handlers)) {
            try {
                navigator.mediaSession.setActionHandler(action, handler);
            } catch (_) {
                continue;
            }
        }
    }

    updateMediaSessionMetadata() {
        if (!this.enableMediaSession || !('mediaSession' in navigator) || !this.currentTrack) {
            return;
        }

        const artwork = this.currentTrack.icon
            ? [{ src: this.currentTrack.icon, sizes: '512x512', type: 'image/png' }]
            : undefined;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: this.currentTrack.title,
            artist: mediaMetadata.artist,
            album: mediaMetadata.album,
            artwork
        });
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
                playbackRate: 1,
                position: this.clamp(this.getCurrentTime(), 0, duration)
            });
        } catch (_) {
            return;
        }
    }

    updateMediaSession() {
        if (!this.enableMediaSession || !('mediaSession' in navigator)) {
            return;
        }

        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
        this.updateMediaSessionMetadata();
        this.updateMediaSessionPosition();
    }

    // ── Event emission ─────────────────────────────────────────────

    emitProgress() {
        this.onProgress?.(this.getState());
    }

    emitState() {
        this.onStateChange?.(this.getState());
    }

    // ── Visibility handling ────────────────────────────────────────

    handleVisibilityChange() {
        if (document.visibilityState === 'visible' && this.audioContext?.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }
        this.updateMediaSessionPosition();
    }

    handlePageShow() {
        this.updateMediaSession();
        this.emitState();
    }

    // ── Timers ─────────────────────────────────────────────────────

    clearBoundaryTimers() {
        if (this.preBoundaryTimer !== null) {
            window.clearTimeout(this.preBoundaryTimer);
            this.preBoundaryTimer = null;
        }

        if (this.boundaryTimer !== null) {
            window.clearTimeout(this.boundaryTimer);
            this.boundaryTimer = null;
        }
    }

    clearTransitionTimer() {
        if (this.transitionTimer !== null) {
            window.clearTimeout(this.transitionTimer);
            this.transitionTimer = null;
        }
    }

    // ── Utility ────────────────────────────────────────────────────

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}
