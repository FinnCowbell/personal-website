import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizeSegments,
    resolvePlaybackState
} from '../content/static/native-audio-player-logic.js';

const segmentedTrack = {
    src: '/audio/full.mp3',
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

test('normalizeSegments returns null when track has no segments', () => {
    assert.equal(normalizeSegments({ src: '/audio/full.mp3' }), null);
});

test('normalizeSegments computes loop and outro durations', () => {
    assert.deepEqual(normalizeSegments(segmentedTrack), {
        introSrc: '/audio/intro.m4a',
        loopSrc: '/audio/loop.m4a',
        outroSrc: '/audio/outro.m4a',
        introEnd: 10,
        loopStart: 10,
        loopEnd: 30,
        totalDuration: 45,
        loopDuration: 20,
        outroDuration: 15
    });
});

test('normalizeSegments allows tracks without an intro or outro asset', () => {
    assert.deepEqual(normalizeSegments({
        segments: {
            loopSrc: '/audio/loop-only.m4a',
            introEnd: 0,
            loopStart: 0,
            loopEnd: 30,
            totalDuration: 30
        }
    }), {
        introSrc: undefined,
        loopSrc: '/audio/loop-only.m4a',
        outroSrc: undefined,
        introEnd: 0,
        loopStart: 0,
        loopEnd: 30,
        totalDuration: 30,
        loopDuration: 30,
        outroDuration: 0
    });
});

test('resolvePlaybackState falls back to full-track playback when no segments exist', () => {
    assert.deepEqual(resolvePlaybackState({
        track: { src: '/audio/full.mp3' },
        segmentConfig: null,
        audioDuration: 100,
        targetTime: 25
    }), {
        mode: 'full',
        src: '/audio/full.mp3',
        offset: 25,
        position: 25
    });
});

test('resolvePlaybackState chooses the intro segment before the loop point', () => {
    const segmentConfig = normalizeSegments(segmentedTrack);
    assert.deepEqual(resolvePlaybackState({
        track: segmentedTrack,
        segmentConfig,
        targetTime: 8
    }), {
        mode: 'intro',
        src: '/audio/intro.m4a',
        offset: 8,
        position: 8
    });
});

test('resolvePlaybackState chooses the loop segment inside the loop window', () => {
    const segmentConfig = normalizeSegments(segmentedTrack);
    assert.deepEqual(resolvePlaybackState({
        track: segmentedTrack,
        segmentConfig,
        targetTime: 18
    }), {
        mode: 'loop',
        src: '/audio/loop.m4a',
        offset: 8,
        position: 18
    });
});

test('resolvePlaybackState chooses the outro segment after the loop window', () => {
    const segmentConfig = normalizeSegments(segmentedTrack);
    assert.deepEqual(resolvePlaybackState({
        track: segmentedTrack,
        segmentConfig,
        targetTime: 40
    }), {
        mode: 'outro',
        src: '/audio/outro.m4a',
        offset: 10,
        position: 40
    });
});

test('resolvePlaybackState clamps times past the end of the segmented track', () => {
    const segmentConfig = normalizeSegments(segmentedTrack);
    assert.deepEqual(resolvePlaybackState({
        track: segmentedTrack,
        segmentConfig,
        targetTime: 999
    }), {
        mode: 'outro',
        src: '/audio/outro.m4a',
        offset: 15,
        position: 45
    });
});

test('resolvePlaybackState preserves absolute position for cross-segment seeks', () => {
    const segmentConfig = normalizeSegments(segmentedTrack);
    assert.equal(resolvePlaybackState({
        track: segmentedTrack,
        segmentConfig,
        targetTime: 30
    }).position, 30);
});

test('resolvePlaybackState starts in the loop segment when a track has no intro', () => {
    const segmentConfig = normalizeSegments({
        segments: {
            loopSrc: '/audio/loop-only.m4a',
            outroSrc: '/audio/outro.m4a',
            introEnd: 0,
            loopStart: 0,
            loopEnd: 30,
            totalDuration: 40
        }
    });

    assert.deepEqual(resolvePlaybackState({
        track: { src: '/audio/full.mp3' },
        segmentConfig,
        targetTime: 0
    }), {
        mode: 'loop',
        src: '/audio/loop-only.m4a',
        offset: 0,
        position: 0
    });
});