import {
    mediaMetadata,
    secretSong as rawSecretSong,
    songs as rawSongs
} from './player-catalog.js';
import { segmentMetadataBySrc } from './player-segments.generated.js';

function inferArtworkType(src) {
    if (typeof src !== 'string') {
        return undefined;
    }

    const normalizedSrc = src.split('?')[0].toLowerCase();

    if (normalizedSrc.endsWith('.jpg') || normalizedSrc.endsWith('.jpeg')) {
        return 'image/jpeg';
    }

    if (normalizedSrc.endsWith('.webp')) {
        return 'image/webp';
    }

    if (normalizedSrc.endsWith('.gif')) {
        return 'image/gif';
    }

    if (normalizedSrc.endsWith('.png')) {
        return 'image/png';
    }

    return undefined;
}

function normalizeArtwork(artwork) {
    if (!artwork) {
        return [];
    }

    if (typeof artwork === 'string') {
        return [{ src: artwork, type: inferArtworkType(artwork) }];
    }

    if (Array.isArray(artwork)) {
        return artwork.flatMap(normalizeArtwork);
    }

    if (typeof artwork.src === 'string') {
        return [{
            ...artwork,
            type: artwork.type ?? inferArtworkType(artwork.src)
        }];
    }

    return [];
}

function dedupeArtwork(artwork) {
    const seen = new Set();

    return artwork.filter((entry) => {
        const key = `${entry.src}|${entry.sizes ?? ''}|${entry.type ?? ''}`;
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function withSegments(track) {
    const segments = segmentMetadataBySrc[track.src];
    if (!segments) {
        return track;
    }

    return {
        ...track,
        segments
    };
}

export { mediaMetadata };

export function collectPlayerImageSources(trackList = [], sharedMetadata = mediaMetadata) {
    const artwork = dedupeArtwork([
        ...normalizeArtwork(sharedMetadata?.artwork),
        ...trackList.flatMap((track) => [
            ...normalizeArtwork(track?.icon),
            ...normalizeArtwork(track?.mediaMetadata?.artwork)
        ])
    ]);

    return artwork
        .map((entry) => entry?.src)
        .filter((src) => typeof src === 'string' && src.length > 0);
}

export function buildTrackMediaMetadata(track) {
    const trackMetadata = track?.mediaMetadata ?? {};
    const artwork = dedupeArtwork([
        ...normalizeArtwork(trackMetadata.artwork),
        ...normalizeArtwork(track?.icon),
        ...normalizeArtwork(mediaMetadata.artwork)
    ]);

    return {
        title: trackMetadata.title ?? track?.title ?? '',
        artist: trackMetadata.artist ?? mediaMetadata.artist ?? '',
        album: trackMetadata.album ?? mediaMetadata.album ?? '',
        artwork: artwork.length > 0 ? artwork : undefined
    };
}

export const songs = rawSongs.map(withSegments);

export const secretSong = withSegments(rawSecretSong);

export const playerImageSources = Object.freeze(
    collectPlayerImageSources([...songs, secretSong])
);