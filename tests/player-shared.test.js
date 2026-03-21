import test from 'node:test';
import assert from 'node:assert/strict';

import { mediaMetadata, secretSong, songs } from '../content/static/player-data.js';
import {
    getTransportOverrideFromSearch,
    shouldUseNativeTransport,
    timestampToSeconds
} from '../content/static/player-shared.js';

test('mediaMetadata exposes the shared album metadata', () => {
    assert.deepEqual(mediaMetadata, {
        artist: 'Finn Navin',
        album: 'BOSS FIGHTS',
        artwork: [
            {
                src: '/assets/favicon/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png'
            },
            {
                src: '/assets/favicon/android-chrome-512x512.png',
                sizes: '512x512',
                type: 'image/png'
            }
        ]
    });
});

test('player data exports the main song catalog and secret song', () => {
    assert.equal(songs.length >= 10, true);
    assert.equal(secretSong.title, "Crabbin'");
    assert.equal(songs.some((song) => song.title === 'Floor 7'), true);
    assert.equal(songs.every((song) => Boolean(song.segments?.loopSrc)), true);
    assert.equal(Boolean(secretSong.segments?.loopSrc), true);
});

test('timestampToSeconds parses mm:ss values', () => {
    assert.equal(timestampToSeconds('02:05.500'), 125.5);
});

test('timestampToSeconds parses hh:mm:ss values', () => {
    assert.equal(timestampToSeconds('01:02:03'), 3723);
});

test('timestampToSeconds returns numeric inputs unchanged', () => {
    assert.equal(timestampToSeconds(42), 42);
});

test('timestampToSeconds rejects invalid timestamps', () => {
    assert.throws(() => timestampToSeconds('bad-value'), /Invalid timestamp/);
});

test('getTransportOverrideFromSearch reads the transport override', () => {
    assert.equal(getTransportOverrideFromSearch('?transport=native'), 'native');
    assert.equal(getTransportOverrideFromSearch('?foo=bar'), null);
});

test('shouldUseNativeTransport respects explicit overrides', () => {
    assert.equal(shouldUseNativeTransport({ search: '?transport=native' }), true);
    assert.equal(shouldUseNativeTransport({ search: '?transport=web-audio' }), false);
});

test('shouldUseNativeTransport enables native mode for iPhone user agents', () => {
    assert.equal(shouldUseNativeTransport({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
        maxTouchPoints: 5,
        platform: 'iPhone'
    }), true);
});

test('shouldUseNativeTransport enables native mode for iPadOS desktop-class safari', () => {
    assert.equal(shouldUseNativeTransport({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
        maxTouchPoints: 5,
        platform: 'MacIntel'
    }), true);
});

test('shouldUseNativeTransport leaves desktop browsers on web-audio by default', () => {
    assert.equal(shouldUseNativeTransport({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
        maxTouchPoints: 0,
        platform: 'MacIntel'
    }), false);
});