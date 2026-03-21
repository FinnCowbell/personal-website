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
    constructor({ duration = 0 } = {}) {
        super();
        this._src = '';
        this.currentTime = 0;
        this.duration = duration;
        this.readyState = 0;
        this.paused = true;
        this.loop = false;
        this.preload = 'metadata';
        this.volume = 1;
    }

    get src() {
        return this._src;
    }

    set src(value) {
        this._src = value ? new URL(value, globalThis.window.location.href).href : '';
    }

    load() {
        this.readyState = 1;
        this.dispatchEvent({ type: 'loadedmetadata' });
        this.dispatchEvent({ type: 'durationchange' });
    }

    async play() {
        this.paused = false;
        this.dispatchEvent({ type: 'play' });
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
        assert.equal(actionHandlers.get('seekto'), null);
        assert.deepEqual(positionStates.at(-1), {});
    } finally {
        restoreGlobals();
    }
});