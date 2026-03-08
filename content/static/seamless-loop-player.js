export class SeamlessLoopPlayer {
    constructor({
        onStateChange,
        onProgress,
        onTrackEnded,
        volume = 0.8,
        maxRepeats = 10,
        maxPlaybackMinutes = 30
    } = {}) {
        this.onStateChange = onStateChange;
        this.onProgress = onProgress;
        this.onTrackEnded = onTrackEnded;
        this.volume = volume;
        this.maxRepeats = maxRepeats;
        this.maxPlaybackSeconds = maxPlaybackMinutes * 60;

        this.audioContext = null;
        this.gainNode = null;
        this.bufferCache = new Map();
        this.bufferLoadPromises = new Map();
        this.trackLoadRequestId = 0;

        this.currentTrack = null;
        this.currentBuffer = null;
        this.currentSource = null;
        this.currentLoop = null;
        this.loopPlaybackActive = false;

        this.isPlaying = false;
        this.repeatEnabled = false;
        this.loopCount = 0;
        this.breakoutActive = false;

        this.lastKnownTime = 0;
        this.sourceStartContextTime = 0;
        this.sourceStartOffset = 0;
        this.loopExitBoundaryContextTime = null;

        this.activePlaybackSeconds = 0;
        this.activePlaybackStartedAt = null;

        this.progressFrame = null;
        this.preBoundaryTimer = null;
        this.boundaryTimer = null;
    }

    async loadTrack(track, { autoplay = false, startTime = 0 } = {}) {
        const requestId = ++this.trackLoadRequestId;
        const wasPlaying = this.isPlaying;
        this.stopCurrentSource();
        this.stopProgressUpdates();

        this.currentTrack = track;
        this.currentBuffer = null;
        this.currentLoop = null;
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

        const buffer = await this.loadBuffer(track.src, { priority: 'high' });
        if (requestId !== this.trackLoadRequestId) {
            return false;
        }

        this.currentBuffer = buffer;
        this.currentLoop = this.normalizeLoop(track, this.currentBuffer.duration);

        this.lastKnownTime = this.clamp(startTime, 0, this.currentBuffer.duration);
        this.loopCount = 0;
        this.breakoutActive = false;
        this.loopExitBoundaryContextTime = null;
        this.loopPlaybackActive = false;
        this.activePlaybackSeconds = 0;
        this.activePlaybackStartedAt = null;
        this.isPlaying = false;

        this.emitProgress();
        this.emitState();

        if (autoplay || wasPlaying) {
            await this.play();
        }

        return true;
    }

    preloadTrack(track, { priority = 'low' } = {}) {
        if (!track?.src) {
            return Promise.resolve(null);
        }

        return this.loadBuffer(track.src, { priority });
    }

    async play() {
        if (!this.currentTrack || !this.currentBuffer) {
            return;
        }

        await this.ensureAudioContext();
        await this.audioContext.resume();

        if (this.isPlaying) {
            return;
        }

        this.startSourceAt(this.lastKnownTime);
        this.isPlaying = true;
        this.activePlaybackStartedAt = this.audioContext.currentTime;
        this.startProgressUpdates();
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

        this.stopCurrentSource();
        this.stopProgressUpdates();
        this.emitProgress();
        this.emitState();
    }

    async seek(seconds) {
        if (!this.currentBuffer) {
            return;
        }

        const nextTime = this.clamp(seconds, 0, this.currentBuffer.duration);
        this.lastKnownTime = nextTime;

        if (!this.isPlaying) {
            this.emitProgress();
            this.emitState();
            return;
        }

        const elapsedBeforeSeek = this.getActivePlaybackSeconds();
        this.stopCurrentSource();
        this.activePlaybackSeconds = elapsedBeforeSeek;
        this.activePlaybackStartedAt = this.audioContext.currentTime;
        this.startSourceAt(nextTime);
        this.emitProgress();
        this.emitState();
    }

    async setRepeat(enabled) {
        const nextValue = Boolean(enabled);
        if (this.repeatEnabled === nextValue) {
            return;
        }

        this.repeatEnabled = nextValue;

        if (!this.currentBuffer) {
            this.emitState();
            return;
        }

        if (!this.isPlaying) {
            this.emitState();
            return;
        }

        if (!nextValue && this.currentSource?.loop && this.loopExitBoundaryContextTime === null) {
            this.disableLoopAtNextBoundary(false);
            this.emitState();
            return;
        }

        if (nextValue && !this.currentSource?.loop && this.shouldUseLooping(this.getCurrentTime())) {
            const currentTime = this.getCurrentTime();
            const elapsedBeforeRestart = this.getActivePlaybackSeconds();
            this.stopCurrentSource();
            this.activePlaybackSeconds = elapsedBeforeRestart;
            this.activePlaybackStartedAt = this.audioContext.currentTime;
            this.startSourceAt(currentTime);
        }

        this.emitState();
    }

    toggleRepeat() {
        return this.setRepeat(!this.repeatEnabled);
    }

    getState() {
        return {
            currentTrack: this.currentTrack,
            isPlaying: this.isPlaying,
            repeatEnabled: this.repeatEnabled,
            breakoutActive: this.breakoutActive,
            loopCount: this.loopCount,
            currentTime: this.getCurrentTime(),
            duration: this.currentBuffer?.duration ?? 0,
            canLoop: Boolean(this.currentLoop),
            loopWindow: this.currentLoop ? { start: this.currentLoop.start, end: this.currentLoop.end } : null,
            isLoopingNow: this.loopPlaybackActive && this.loopExitBoundaryContextTime === null
        };
    }

    destroy() {
        this.stopCurrentSource();
        this.stopProgressUpdates();
        if (this.audioContext?.state !== 'closed') {
            this.audioContext?.close();
        }
        this.audioContext = null;
        this.gainNode = null;
        this.bufferCache.clear();
        this.bufferLoadPromises.clear();
    }

    async ensureAudioContext() {
        if (this.audioContext) {
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContextClass();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.audioContext.destination);
    }

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

    normalizeLoop(track, duration) {
        const loop = track?.loop;
        if (!loop) {
            return null;
        }

        const start = Number.isFinite(loop.start) ? loop.start : 0;
        const rawEnd = Number.isFinite(loop.end) ? loop.end : duration;
        const end = this.clamp(rawEnd, 0, duration);
        if (end <= start) {
            return null;
        }

        return {
            start,
            end
        };
    }

    shouldUseLooping(offset) {
        return Boolean(
            this.repeatEnabled &&
            this.currentLoop &&
            !this.breakoutActive &&
            this.loopCount < this.maxRepeats &&
            this.getActivePlaybackSeconds() < this.maxPlaybackSeconds &&
            offset < this.currentLoop.end
        );
    }

    startSourceAt(offset) {
        if (!this.currentBuffer) {
            return;
        }

        const clampedOffset = this.clamp(offset, 0, this.currentBuffer.duration);
        const source = this.audioContext.createBufferSource();
        source.buffer = this.currentBuffer;
        source.connect(this.gainNode);

        const shouldLoop = this.shouldUseLooping(clampedOffset);
        if (shouldLoop) {
            source.loop = true;
            source.loopStart = this.currentLoop.start;
            source.loopEnd = this.currentLoop.end;
        }

        source.onended = () => this.handleSourceEnded(source);

        this.currentSource = source;
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

    stopCurrentSource() {
        this.clearBoundaryTimers();

        if (!this.currentSource) {
            return;
        }

        const source = this.currentSource;
        this.currentSource = null;
        this.loopPlaybackActive = false;
        source.onended = null;
        try {
            source.stop();
        } catch (error) {
            return;
        } finally {
            source.disconnect();
        }
    }

    handleSourceEnded(source) {
        if (source !== this.currentSource) {
            return;
        }

        this.clearBoundaryTimers();
        this.stopProgressUpdates();
        source.disconnect();
        this.currentSource = null;
        this.loopPlaybackActive = false;
        this.lastKnownTime = this.currentBuffer?.duration ?? 0;

        if (!this.isPlaying) {
            this.emitProgress();
            this.emitState();
            return;
        }

        this.activePlaybackSeconds = this.getActivePlaybackSeconds();
        this.activePlaybackStartedAt = null;
        this.isPlaying = false;

        this.emitProgress();
        this.emitState();
        this.onTrackEnded?.(this.getState());
    }

    scheduleBoundaryTimers() {
        this.clearBoundaryTimers();
        if (!this.currentSource?.loop || !this.currentLoop) {
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
        if (!this.currentSource?.loop || !this.currentLoop || this.loopExitBoundaryContextTime !== null) {
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
        this.loopExitBoundaryContextTime = this.audioContext.currentTime + secondsUntilBoundary;
        this.currentSource.loop = false;

        if (markBreakout) {
            this.breakoutActive = true;
        }

        window.clearTimeout(this.preBoundaryTimer);
        this.preBoundaryTimer = null;
    }

    handleBoundaryCrossed() {
        if (!this.currentLoop) {
            return;
        }

        if (this.loopExitBoundaryContextTime !== null) {
            this.clearBoundaryTimers();
            this.emitState();
            return;
        }

        this.loopCount += 1;
        this.emitState();
        this.scheduleBoundaryTimers();
    }

    getCurrentTime() {
        if (!this.currentBuffer) {
            return 0;
        }

        if (!this.currentSource || !this.isPlaying) {
            return this.lastKnownTime;
        }

        const elapsed = Math.max(0, this.audioContext.currentTime - this.sourceStartContextTime);

        if (!this.loopPlaybackActive || !this.currentLoop) {
            return this.clamp(this.sourceStartOffset + elapsed, 0, this.currentBuffer.duration);
        }

        const timeUntilLoopBoundary = this.currentLoop.end - this.sourceStartOffset;
        if (elapsed < timeUntilLoopBoundary) {
            return this.clamp(this.sourceStartOffset + elapsed, 0, this.currentBuffer.duration);
        }

        if (this.loopExitBoundaryContextTime !== null) {
            const elapsedSinceExitBoundary = this.audioContext.currentTime - this.loopExitBoundaryContextTime;
            if (elapsedSinceExitBoundary >= 0) {
                return this.clamp(this.currentLoop.end + elapsedSinceExitBoundary, 0, this.currentBuffer.duration);
            }
        }

        const loopDuration = this.currentLoop.end - this.currentLoop.start;
        const loopElapsed = elapsed - timeUntilLoopBoundary;
        const loopProgress = ((loopElapsed % loopDuration) + loopDuration) % loopDuration;
        return this.clamp(this.currentLoop.start + loopProgress, this.currentLoop.start, this.currentLoop.end);
    }

    getSecondsUntilNextBoundary() {
        if (!this.currentLoop) {
            return 0;
        }

        const currentTime = this.getCurrentTime();
        if (currentTime < this.currentLoop.end) {
            return this.currentLoop.end - currentTime;
        }

        return this.currentLoop.end - this.currentLoop.start;
    }

    getActivePlaybackSeconds() {
        if (!this.isPlaying || this.activePlaybackStartedAt === null) {
            return this.activePlaybackSeconds;
        }

        return this.activePlaybackSeconds + (this.audioContext.currentTime - this.activePlaybackStartedAt);
    }

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

    emitProgress() {
        this.onProgress?.(this.getState());
    }

    emitState() {
        this.onStateChange?.(this.getState());
    }

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

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}
