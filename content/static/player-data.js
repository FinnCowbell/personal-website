import {
    mediaMetadata,
    secretSong as rawSecretSong,
    songs as rawSongs
} from './player-catalog.js';
import { segmentMetadataBySrc } from './player-segments.generated.js';

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

export const songs = rawSongs.map(withSegments);

export const secretSong = withSegments(rawSecretSong);