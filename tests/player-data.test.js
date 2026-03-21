import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTrackMediaMetadata } from '../content/static/player-data.js';

test('buildTrackMediaMetadata prefers track artwork and keeps shared fallback artwork', () => {
    const metadata = buildTrackMediaMetadata({
        title: 'Floor 7',
        icon: '/assets/img/bossfights/elevator.png'
    });

    assert.equal(metadata.title, 'Floor 7');
    assert.equal(metadata.artist, 'Finn Navin');
    assert.equal(metadata.album, 'BOSS FIGHTS');
    assert.deepEqual(metadata.artwork, [
        {
            src: '/assets/img/bossfights/elevator.png',
            type: 'image/png'
        },
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
    ]);
});

test('buildTrackMediaMetadata honors per-track metadata overrides', () => {
    const metadata = buildTrackMediaMetadata({
        title: 'Ignored title',
        icon: '/assets/img/bossfights/elevator.png',
        mediaMetadata: {
            title: 'Custom title',
            artist: 'Guest Artist',
            album: 'Side Quests',
            artwork: {
                src: '/assets/img/bossfights/walkman.png'
            }
        }
    });

    assert.equal(metadata.title, 'Custom title');
    assert.equal(metadata.artist, 'Guest Artist');
    assert.equal(metadata.album, 'Side Quests');
    assert.deepEqual(metadata.artwork, [
        {
            src: '/assets/img/bossfights/walkman.png',
            type: 'image/png'
        },
        {
            src: '/assets/img/bossfights/elevator.png',
            type: 'image/png'
        },
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
    ]);
});