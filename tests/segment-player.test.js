import test from 'node:test';
import assert from 'node:assert/strict';

import { SegmentPlayer } from '../content/static/segment-player.js';

function createLoopingSegmentPlayerMock({
    loopStart = 10,
    loopEnd = 30,
    totalDuration = 45,
    loopDuration = 20,
    sourceStartOffset = 0,
    elapsed = 0,
    exitBoundaryTime = null
} = {}) {
    return {
        currentTrack: { src: '/audio/full.mp3' },
        currentMode: 'loop',
        isPlaying: true,
        segmentConfig: {
            loopStart,
            loopEnd,
            totalDuration
        },
        segmentBuffers: {
            loop: { duration: loopDuration }
        },
        loopPlaybackActive: true,
        loopExitBoundaryContextTime: exitBoundaryTime,
        sourceStartOffset,
        sourceStartContextTime: 0,
        audioContext: {
            currentTime: elapsed
        },
        clamp: SegmentPlayer.prototype.clamp,
        getLoopProgress: SegmentPlayer.prototype.getLoopProgress
    };
}

test('segment player reports wrapped loop time correctly from a non-zero loop offset', () => {
    const player = createLoopingSegmentPlayerMock({
        sourceStartOffset: 5,
        elapsed: 16
    });

    assert.equal(
        SegmentPlayer.prototype.getSegmentedCurrentTime.call(player, 16),
        11
    );
});

test('segment player computes the next loop boundary correctly from a non-zero loop offset', () => {
    const player = createLoopingSegmentPlayerMock({
        sourceStartOffset: 5,
        elapsed: 16
    });

    assert.equal(
        SegmentPlayer.prototype.getSecondsUntilNextBoundary.call(player),
        19
    );
});

test('segment player advances into the outro after a loop exit boundary', () => {
    const player = createLoopingSegmentPlayerMock({
        totalDuration: 52,
        elapsed: 13,
        exitBoundaryTime: 12
    });

    assert.equal(
        SegmentPlayer.prototype.getSegmentedCurrentTime.call(player, 13),
        31
    );
});