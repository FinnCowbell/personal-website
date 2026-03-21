import test from 'node:test';
import assert from 'node:assert/strict';

import { secretSong, songs } from '../content/static/player-data.js';
import {
    createPlaybackPersistence,
    createPersistedPlaybackState,
    findTrackIndexBySrc,
    readPersistedPlaybackState,
    writePersistedPlaybackState
} from '../content/static/player-persistence.js';

function createStorageMock(initialEntries = {}) {
    const store = new Map(Object.entries(initialEntries));

    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        }
    };
}

test('createPersistedPlaybackState normalizes playback snapshots', () => {
    assert.deepEqual(createPersistedPlaybackState({
        trackSrc: '/music/floor-7.m4a',
        currentTime: -5,
        isPlaying: 1,
        repeatEnabled: ''
    }), {
        version: 1,
        trackSrc: '/music/floor-7.m4a',
        currentTime: 0,
        isPlaying: true,
        repeatEnabled: false
    });
});

test('readPersistedPlaybackState ignores invalid storage payloads', () => {
    const storage = createStorageMock({
        bossFightsPlaybackState: '{bad json'
    });

    assert.equal(readPersistedPlaybackState(storage), null);
});

test('writePersistedPlaybackState round-trips a saved snapshot', () => {
    const storage = createStorageMock();

    assert.equal(writePersistedPlaybackState({
        trackSrc: '/music/floor-7.m4a',
        currentTime: 42.5,
        isPlaying: false,
        repeatEnabled: true
    }, storage), true);

    assert.deepEqual(readPersistedPlaybackState(storage), {
        version: 1,
        trackSrc: '/music/floor-7.m4a',
        currentTime: 42.5,
        isPlaying: false,
        repeatEnabled: true
    });
});

test('findTrackIndexBySrc resolves saved tracks back into the catalog', () => {
    assert.equal(findTrackIndexBySrc(songs, secretSong.src), songs.findIndex((song) => song.src === secretSong.src));
    assert.equal(findTrackIndexBySrc(songs, '/missing-track.m4a'), -1);
});

test('createPlaybackPersistence restores saved state through the provided loader', async () => {
    const storage = createStorageMock();
    const savedTrack = songs[2];
    const setRepeatCalls = [];
    const loadCalls = [];
    const syncedStates = [];
    const progressedStates = [];

    let playerState = {
        currentTrack: null,
        currentTime: 0,
        isPlaying: false,
        repeatEnabled: false
    };

    writePersistedPlaybackState({
        trackSrc: savedTrack.src,
        currentTime: 37.25,
        isPlaying: false,
        repeatEnabled: true
    }, storage);

    const persistence = createPlaybackPersistence({
        player: {
            getState() {
                return playerState;
            },
            async setRepeat(enabled) {
                setRepeatCalls.push(enabled);
                playerState = {
                    ...playerState,
                    repeatEnabled: enabled
                };
            }
        },
        trackList: songs,
        async loadTrackByIndex(index, options) {
            loadCalls.push({ index, options });
            playerState = {
                currentTrack: songs[index],
                currentTime: options.startTime,
                isPlaying: false,
                repeatEnabled: false
            };
            return true;
        },
        syncPlayerState(state) {
            syncedStates.push(state);
        },
        updateProgress(state) {
            progressedStates.push(state);
        },
        storage,
        windowTarget: { addEventListener() {}, removeEventListener() {} },
        documentTarget: {
            visibilityState: 'visible',
            addEventListener() {},
            removeEventListener() {}
        }
    });

    assert.equal(await persistence.restoreState(), true);
    assert.deepEqual(loadCalls, [{
        index: songs.findIndex((song) => song.src === savedTrack.src),
        options: {
            autoplay: false,
            resetSkipState: false,
            startTime: 37.25
        }
    }]);
    assert.deepEqual(setRepeatCalls, [true]);
    assert.equal(syncedStates.at(-1)?.currentTrack?.src, savedTrack.src);
    assert.equal(syncedStates.at(-1)?.repeatEnabled, true);
    assert.equal(progressedStates.at(-1)?.currentTime, 37.25);
});