const PLAYBACK_STATE_STORAGE_KEY = 'bossFightsPlaybackState';
const PLAYBACK_STATE_VERSION = 1;

function normalizePlaybackTime(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(value, 0);
}

export function createPersistedPlaybackState({
    trackSrc,
    currentTime = 0,
    isPlaying = false,
    repeatEnabled = false
} = {}) {
    if (typeof trackSrc !== 'string' || trackSrc.length === 0) {
        return null;
    }

    return {
        version: PLAYBACK_STATE_VERSION,
        trackSrc,
        currentTime: normalizePlaybackTime(currentTime),
        isPlaying: Boolean(isPlaying),
        repeatEnabled: Boolean(repeatEnabled)
    };
}

export function readPersistedPlaybackState(storage = globalThis.localStorage) {
    if (!storage?.getItem) {
        return null;
    }

    try {
        const rawValue = storage.getItem(PLAYBACK_STATE_STORAGE_KEY);
        if (!rawValue) {
            return null;
        }

        const parsed = JSON.parse(rawValue);
        if (parsed?.version !== PLAYBACK_STATE_VERSION) {
            return null;
        }

        return createPersistedPlaybackState(parsed);
    } catch (_) {
        return null;
    }
}

export function writePersistedPlaybackState(snapshot, storage = globalThis.localStorage) {
    if (!storage?.setItem) {
        return false;
    }

    const normalizedSnapshot = createPersistedPlaybackState(snapshot);
    if (!normalizedSnapshot) {
        return false;
    }

    try {
        storage.setItem(PLAYBACK_STATE_STORAGE_KEY, JSON.stringify(normalizedSnapshot));
        return true;
    } catch (_) {
        return false;
    }
}

export function findTrackIndexBySrc(trackList, trackSrc) {
    if (!Array.isArray(trackList) || typeof trackSrc !== 'string' || trackSrc.length === 0) {
        return -1;
    }

    return trackList.findIndex((track) => track?.src === trackSrc);
}

export function createPlaybackPersistence({
    player,
    trackList,
    loadTrackByIndex,
    syncPlayerState,
    updateProgress,
    storage = globalThis.localStorage,
    windowTarget = globalThis.window,
    documentTarget = globalThis.document
} = {}) {
    let cleanup = null;

    function persistState(state = player?.getState?.()) {
        const snapshot = createPersistedPlaybackState({
            trackSrc: state?.currentTrack?.src,
            currentTime: state?.currentTime,
            isPlaying: state?.isPlaying,
            repeatEnabled: state?.repeatEnabled
        });

        if (!snapshot) {
            return false;
        }

        return writePersistedPlaybackState(snapshot, storage);
    }

    async function restoreState() {
        const savedState = readPersistedPlaybackState(storage);
        if (!savedState) {
            return false;
        }

        const savedIndex = findTrackIndexBySrc(trackList, savedState.trackSrc);
        if (savedIndex < 0) {
            return false;
        }

        const didLoad = await loadTrackByIndex?.(savedIndex, {
            autoplay: false,
            resetSkipState: false,
            startTime: savedState.currentTime
        });
        if (!didLoad) {
            return false;
        }

        await player?.setRepeat?.(savedState.repeatEnabled);

        const nextState = player?.getState?.();
        syncPlayerState?.(nextState);
        updateProgress?.(nextState);
        return true;
    }

    function registerEventHandlers() {
        if (cleanup || !windowTarget?.addEventListener || !documentTarget?.addEventListener) {
            return cleanup;
        }

        const saveCurrentPlaybackState = () => {
            persistState();
        };

        const handleVisibilityChange = () => {
            if (documentTarget.visibilityState === 'hidden') {
                saveCurrentPlaybackState();
            }
        };

        windowTarget.addEventListener('pagehide', saveCurrentPlaybackState);
        windowTarget.addEventListener('beforeunload', saveCurrentPlaybackState);
        documentTarget.addEventListener('visibilitychange', handleVisibilityChange);

        cleanup = () => {
            windowTarget.removeEventListener?.('pagehide', saveCurrentPlaybackState);
            windowTarget.removeEventListener?.('beforeunload', saveCurrentPlaybackState);
            documentTarget.removeEventListener?.('visibilitychange', handleVisibilityChange);
            cleanup = null;
        };

        return cleanup;
    }

    return {
        persistState,
        restoreState,
        registerEventHandlers
    };
}