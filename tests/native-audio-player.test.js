import test from 'node:test';
import assert from 'node:assert/strict';

import { NativeAudioPlayer } from '../content/static/native-audio-player.js';

const segmentedTrack = {
    src: '/audio/full.mp3',
    title: 'Segmented Track',
    artist: 'Test Artist',
    segments: {
        introSrc: '/audio/intro.m4a',
        loopSrc: '/audio/loop.m4a',
        outroSrc: '/audio/outro.m4a',
        introEnd: 10,
        loopStart: 10,
        loopEnd: 30,
        totalDuration: 45
    }
};

class MockEventTarget {
    constructor() {
        this.listeners = new Map();
    }

    addEventListener(type, listener, options = {}) {
        const entries = this.listeners.get(type) ?? [];
        entries.push({ listener, once: Boolean(options?.once) });
        this.listeners.set(type, entries);
    }

    removeEventListener(type, listener) {
        const entries = this.listeners.get(type) ?? [];
        this.listeners.set(type, entries.filter((entry) => entry.listener !== listener));
    }

    dispatchEvent(event) {
        const entries = [...(this.listeners.get(event.type) ?? [])];
        for (const entry of entries) {
            entry.listener.call(this, event);
            if (entry.once) {
                this.removeEventListener(event.type, entry.listener);
            }
        }
    }
}

class MockAudioElement extends MockEventTarget {
    constructor({ duration = 0, failLoadsFor = null } = {}) {
        super();
        this._src = '';
        this.currentTime = 0;
        this.duration = duration;
        this.readyState = 0;
        this.paused = true;
        this.loop = false;
        this.preload = 'metadata';
        this.volume = 1;
        this.error = null;
        this.failLoadsFor = failLoadsFor ?? new Set();
        this.loadCount = 0;
    }

    get src() {
        return this._src;
    }

    set src(value) {
        this._src = value ? new URL(value, globalThis.window.location.href).href : '';
    }

    load() {
        this.loadCount += 1;

        if (this.failLoadsFor.has(this._src)) {
            this.readyState = 0;
            this.error = { code: 2 };
            this.dispatchEvent({ type: 'error' });
            return;
        }

        this.readyState = 1;
        this.error = null;
        this.dispatchEvent({ type: 'loadedmetadata' });
        this.dispatchEvent({ type: 'loadeddata' });
        this.dispatchEvent({ type: 'canplaythrough' });
        this.dispatchEvent({ type: 'durationchange' });
    }

    async play() {
        this.paused = false;
        this.dispatchEvent({ type: 'play' });
        this.dispatchEvent({ type: 'playing' });
    }

    pause() {
        const wasPlaying = !this.paused;
        this.paused = true;
        if (wasPlaying) {
            this.dispatchEvent({ type: 'pause' });
        }
    }

    removeAttribute(name) {
        if (name === 'src') {
            this._src = '';
        }
    }
}

function installBrowserGlobals() {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const previousMediaMetadata = Object.getOwnPropertyDescriptor(globalThis, 'MediaMetadata');

    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: {
            location: { href: 'https://example.test/player' },
            addEventListener() {},
            removeEventListener() {}
        }
    });

    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        writable: true,
        value: {
            addEventListener() {},
            removeEventListener() {},
            visibilityState: 'visible'
        }
    });

    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: {
            mediaSession: {
                setActionHandler() {},
                setPositionState() {},
                metadata: null,
                playbackState: 'none'
            }
        }
    });

    Object.defineProperty(globalThis, 'MediaMetadata', {
        configurable: true,
        writable: true,
        value: class MediaMetadata {
            constructor(init) {
                Object.assign(this, init);
            }
        }
    });

    return () => {
        if (previousWindow) {
            Object.defineProperty(globalThis, 'window', previousWindow);
        } else {
            delete globalThis.window;
        }

        if (previousDocument) {
            Object.defineProperty(globalThis, 'document', previousDocument);
        } else {
            delete globalThis.document;
        }

        if (previousNavigator) {
            Object.defineProperty(globalThis, 'navigator', previousNavigator);
        } else {
            delete globalThis.navigator;
        }

        if (previousMediaMetadata) {
            Object.defineProperty(globalThis, 'MediaMetadata', previousMediaMetadata);
        } else {
            delete globalThis.MediaMetadata;
        }
    };
}

test('NativeAudioPlayer stays on the full track on mobile until repeat is enabled', async () => {
    const restoreGlobals = installBrowserGlobals();

    try {
        const audioElement = new MockAudioElement({ duration: 45 });
        const player = new NativeAudioPlayer({
            audioElement,
            preferFullTrackWhenRepeatDisabled: true
        });

        await player.loadTrack(segmentedTrack, { startTime: 18 });

        assert.equal(player.currentMode, 'full');
        assert.equal(audioElement.src, 'https://example.test/audio/full.mp3');
        assert.equal(audioElement.currentTime, 18);
        assert.equal(player.getState().currentTime, 18);
    } finally {
        restoreGlobals();
    }
});

test('NativeAudioPlayer swaps between full and loop sources without losing absolute position', async () => {
    const restoreGlobals = installBrowserGlobals();

    try {
        const audioElement = new MockAudioElement({ duration: 45 });
        const player = new NativeAudioPlayer({
            audioElement,
            preferFullTrackWhenRepeatDisabled: true
        });

        await player.loadTrack(segmentedTrack, { startTime: 18 });
        await player.setRepeat(true);

        assert.equal(player.currentMode, 'loop');
        assert.equal(audioElement.src, 'https://example.test/audio/loop.m4a');
        assert.equal(audioElement.currentTime, 8);
        assert.equal(player.getState().currentTime, 18);

        await player.setRepeat(false);

        assert.equal(player.currentMode, 'full');
        assert.equal(audioElement.src, 'https://example.test/audio/full.mp3');
        assert.equal(audioElement.currentTime, 18);
        assert.equal(player.getState().currentTime, 18);
    } finally {
        restoreGlobals();
    }
});

test('NativeAudioPlayer keeps requested playback intent through segmented source swaps', async () => {
    const restoreGlobals = installBrowserGlobals();

    try {
        const audioElement = new MockAudioElement({ duration: 45 });
        const player = new NativeAudioPlayer({
            audioElement,
            preferFullTrackWhenRepeatDisabled: true
        });

        await player.loadTrack(segmentedTrack, { startTime: 18, autoplay: true });
        assert.equal(player.getState().playbackRequested, true);

        await player.setRepeat(true);
        assert.equal(player.currentMode, 'loop');
        assert.equal(player.getState().playbackRequested, true);

        await player.seek(22);
        assert.equal(player.getState().playbackRequested, true);

        player.pause();
        assert.equal(player.getState().playbackRequested, false);
    } finally {
        restoreGlobals();
    }
});

test('NativeAudioPlayer can prefer track navigation controls over seek controls', async () => {
    const restoreGlobals = installBrowserGlobals();

    try {
        const actionHandlers = new Map();
        const positionStates = [];
        globalThis.navigator.mediaSession.setActionHandler = (action, handler) => {
            actionHandlers.set(action, handler);
        };
        globalThis.navigator.mediaSession.setPositionState = (state) => {
            positionStates.push(state);
        };

        const audioElement = new MockAudioElement({ duration: 45 });
        const player = new NativeAudioPlayer({
            audioElement,
            preferTrackNavigationControls: true
        });

        await player.loadTrack(segmentedTrack, { startTime: 12, autoplay: true });

        assert.equal(actionHandlers.has('previoustrack'), true);
        assert.equal(actionHandlers.has('nexttrack'), true);
        assert.equal(actionHandlers.get('seekbackward'), null);
        assert.equal(actionHandlers.get('seekforward'), null);
        assert.equal(typeof actionHandlers.get('seekto'), 'function');
        assert.deepEqual(positionStates.at(-1), {
            duration: 45,
            playbackRate: 1,
            position: 12
        });
    } finally {
        restoreGlobals();
    }
});

test('NativeAudioPlayer can defer media session handler registration until playing', async () => {
    const restoreGlobals = installBrowserGlobals();

    try {
        const actionCalls = [];
        globalThis.navigator.mediaSession.setActionHandler = (action, handler) => {
            actionCalls.push({ action, handler });
        };

        const audioElement = new MockAudioElement({ duration: 45 });
        const player = new NativeAudioPlayer({
            audioElement,
            mediaSessionHandlerTiming: 'playing'
        });

        assert.equal(actionCalls.length, 0);

        await player.loadTrack(segmentedTrack, { startTime: 12, autoplay: true });

        assert.equal(actionCalls.some((entry) => entry.action === 'nexttrack'), true);
        assert.equal(actionCalls.some((entry) => entry.action === 'previoustrack'), true);
    } finally {
        restoreGlobals();
    }
});

test('NativeAudioPlayer can register media session handlers on init and playing', async () => {
    const restoreGlobals = installBrowserGlobals();

    try {
        const actionCalls = [];
        globalThis.navigator.mediaSession.setActionHandler = (action, handler) => {
            actionCalls.push({ action, handler });
        };

        const audioElement = new MockAudioElement({ duration: 45 });
        const player = new NativeAudioPlayer({
            audioElement,
            mediaSessionHandlerTiming: 'both'
        });

        const initialCallCount = actionCalls.length;
        await player.loadTrack(segmentedTrack, { startTime: 12, autoplay: true });

        assert.equal(initialCallCount > 0, true);
        assert.equal(actionCalls.length > initialCallCount, true);
    } finally {
        restoreGlobals();
    }
});

test('NativeAudioPlayer preloads full and segmented sources for upcoming tracks', async () => {
    const restoreGlobals = installBrowserGlobals();

    try {
        const audioElement = new MockAudioElement({ duration: 45 });
        const preloadedAudioElements = [];
        const player = new NativeAudioPlayer({
            audioElement,
            createPreloadAudio: () => {
                const preloadAudio = new MockAudioElement({ duration: 45 });
                preloadedAudioElements.push(preloadAudio);
                return preloadAudio;
            },
            maxPreloadedSources: 8
        });

        await player.preloadTrack(segmentedTrack);

        assert.deepEqual(
            preloadedAudioElements.map((element) => element.src),
            [
                'https://example.test/audio/full.mp3',
                'https://example.test/audio/intro.m4a',
                'https://example.test/audio/loop.m4a',
                'https://example.test/audio/outro.m4a'
            ]
        );
        assert.equal(preloadedAudioElements.every((element) => element.preload === 'auto'), true);
        assert.equal(preloadedAudioElements.every((element) => element.loadCount === 1), true);
    } finally {
        restoreGlobals();
    }
});

test('NativeAudioPlayer reports load failures and clears the error on a successful retry', async () => {
    const restoreGlobals = installBrowserGlobals();

    try {
        const failingSource = 'https://example.test/audio/full.mp3';
        const failLoadsFor = new Set([failingSource]);
        const audioElement = new MockAudioElement({ duration: 45, failLoadsFor });
        const player = new NativeAudioPlayer({
            audioElement,
            preferFullTrackWhenRepeatDisabled: true
        });

        await assert.rejects(
            player.loadTrack(segmentedTrack, { startTime: 5 }),
            /Failed to load audio source/
        );

        assert.equal(player.getState().hasError, true);
        assert.match(player.getState().errorReason, /Failed to load audio source/);

        failLoadsFor.clear();
        await player.loadTrack(segmentedTrack, { startTime: 5 });

        assert.equal(player.getState().hasError, false);
        assert.equal(player.getState().errorReason, null);
        assert.equal(audioElement.currentTime, 5);
    } finally {
        restoreGlobals();
    }
});