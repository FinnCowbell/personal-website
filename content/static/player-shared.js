export function timestampToSeconds(timestamp) {
    if (typeof timestamp === 'number') {
        return timestamp;
    }

    const parts = String(timestamp).split(':').map(Number);

    if (!parts.every(Number.isFinite) || parts.length < 2 || parts.length > 3) {
        throw new Error(`Invalid timestamp: ${timestamp}`);
    }

    if (parts.length === 2) {
        const [minutes, seconds] = parts;
        return (minutes * 60) + seconds;
    }

    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
}

export function getTransportOverrideFromSearch(search = '') {
    const params = new URLSearchParams(search);
    return params.get('transport');
}

function normalizeChoice(value, allowedValues) {
    if (typeof value !== 'string') {
        return null;
    }

    return allowedValues.includes(value) ? value : null;
}

export function getPlayerExperimentOverridesFromSearch(search = '') {
    const params = new URLSearchParams(search);

    return {
        nativeSegments: normalizeChoice(params.get('nativeSegments'), ['repeat-only', 'always']),
        nativeControls: normalizeChoice(params.get('nativeControls'), ['tracks', 'seek']),
        nativeHandlerTiming: normalizeChoice(params.get('nativeHandlerTiming'), ['init', 'playing', 'both'])
    };
}

export function isMobilePlaybackDevice({
    userAgent = '',
    maxTouchPoints = 0,
    platform = ''
} = {}) {
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
        || (platform === 'MacIntel' && maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    const isMobile = /Mobi|Mobile/i.test(userAgent);

    return isIOS || isAndroid || (isMobile && maxTouchPoints > 0);
}

export function shouldUseNativeTransport({
    search = '',
    userAgent = '',
    maxTouchPoints = 0,
    platform = ''
} = {}) {
    const override = getTransportOverrideFromSearch(search);
    if (override === 'native') {
        return true;
    }

    if (override === 'web-audio') {
        return false;
    }

    return isMobilePlaybackDevice({ userAgent, maxTouchPoints, platform });
}