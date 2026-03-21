export function normalizeSegments(track) {
    const segments = track?.segments;
    if (!segments) {
        return null;
    }

    const requiredValues = [
        segments.loopSrc,
        segments.introEnd,
        segments.loopStart,
        segments.loopEnd,
        segments.totalDuration
    ];

    if (requiredValues.some((value) => value === undefined || value === null)) {
        return null;
    }

    return {
        introSrc: segments.introSrc,
        loopSrc: segments.loopSrc,
        outroSrc: segments.outroSrc,
        introEnd: segments.introEnd,
        loopStart: segments.loopStart,
        loopEnd: segments.loopEnd,
        totalDuration: segments.totalDuration,
        loopDuration: segments.loopEnd - segments.loopStart,
        outroDuration: segments.totalDuration - segments.loopEnd
    };
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function resolvePlaybackState({
    track,
    segmentConfig,
    audioDuration = Number.MAX_SAFE_INTEGER,
    targetTime = 0
} = {}) {
    if (!track) {
        return { mode: 'full', src: '', offset: 0, position: 0 };
    }

    if (!segmentConfig) {
        const duration = Number.isFinite(audioDuration) ? audioDuration : Number.MAX_SAFE_INTEGER;
        const position = clamp(targetTime, 0, duration);
        return {
            mode: 'full',
            src: track.src,
            offset: position,
            position
        };
    }

    const clampedTime = clamp(targetTime, 0, segmentConfig.totalDuration);
    if (segmentConfig.introSrc && clampedTime < segmentConfig.introEnd) {
        return {
            mode: 'intro',
            src: segmentConfig.introSrc,
            offset: clampedTime,
            position: clampedTime
        };
    }

    if (clampedTime < segmentConfig.loopEnd) {
        return {
            mode: 'loop',
            src: segmentConfig.loopSrc,
            offset: clampedTime - segmentConfig.loopStart,
            position: clampedTime
        };
    }

    if (!segmentConfig.outroSrc) {
        return {
            mode: 'loop',
            src: segmentConfig.loopSrc,
            offset: Math.min(
                clampedTime - segmentConfig.loopStart,
                segmentConfig.loopDuration
            ),
            position: clampedTime
        };
    }

    return {
        mode: 'outro',
        src: segmentConfig.outroSrc,
        offset: clampedTime - segmentConfig.loopEnd,
        position: clampedTime
    };
}