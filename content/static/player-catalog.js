import { timestampToSeconds } from './player-shared.js';

const defaultLoop = {
    start: 0,
    end: null
};

export const mediaMetadata = Object.freeze({
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

export const songs = [
    {
        title: 'Fungal Floor',
        description: 'MAY 2025 - Boutique. On the Catwalk',
        src: '/assets/music/boss-fights/Fungal Floor.mp3',
        icon: '/assets/img/bossfights/mushroom.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:00.000'),
            end: timestampToSeconds('00:02:05.042')
        }
    },
    {
        title: 'Moshed Potato',
        description: 'AUG 2024 - Everyones looking at you',
        src: '/assets/music/boss-fights/Bassaline.mp3',
        icon: '/assets/img/bossfights/crowd.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:12.468'),
            end: timestampToSeconds('00:03:38.182')
        }
    },
    {
        title: 'Shadows',
        description: "FEB 2025 - Maybe they're friendly",
        src: '/assets/music/boss-fights/M W Highs.mp3',
        icon: '/assets/img/bossfights/shadows.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:39.375'),
            end: timestampToSeconds('00:05:22.508')
        }
    },
    {
        title: 'Clawing',
        description: "JAN 2025 - There's is a way out.",
        src: '/assets/music/boss-fights/Dug Fork.mp3',
        icon: '/assets/img/bossfights/hallway.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:09.789'),
            end: timestampToSeconds('00:02:45.474')
        }
    },
    {
        title: 'Floor 7',
        description: 'JAN 2024 - Almost there',
        src: '/assets/music/boss-fights/15M.mp3',
        icon: '/assets/img/bossfights/elevator.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:47.260'),
            end: timestampToSeconds('00:02:04.250')
        }
    },
    {
        title: 'Honch',
        description: 'APR 2025 - *pixelated crowd cheers*',
        src: '/assets/music/boss-fights/SF.mp3',
        icon: '/assets/img/bossfights/pow.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:21.771'),
            end: timestampToSeconds('00:01:35.829')
        }
    },
    {
        title: 'Mouse Army',
        description: "JAN 2024 - There's too many of them",
        src: '/assets/music/boss-fights/Twinning.mp3',
        icon: '/assets/img/bossfights/mouse.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:24.000'),
            end: timestampToSeconds('00:02:18.480')
        }
    },
    {
        title: 'Firewall',
        description: 'MAY 2021 - Pass through',
        src: '/assets/music/boss-fights/HARPIN.mp3',
        icon: '/assets/img/bossfights/gate.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:06.486'),
            end: timestampToSeconds('00:02:09.730')
        }
    },
    {
        title: 'Boulder',
        description: 'SEP 2023 - H I  T H E R E.',
        src: '/assets/music/boss-fights/H I H.mp3',
        icon: '/assets/img/bossfights/boulder.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:50.000'),
            end: timestampToSeconds('00:02:22.500')
        }
    },
    {
        title: 'Wonk 2A',
        description: 'FEB 2025 - Stream of consciousness',
        src: '/assets/music/boss-fights/WONK2A.mp3',
        icon: '/assets/img/bossfights/waves.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:00.909'),
            end: timestampToSeconds('00:01:17.273')
        }
    }
];

export const secretSong = {
    title: "Crabbin'",
    description: 'MAY 2020 - Ay, who let ya in the back room',
    src: '/assets/music/boss-fights/Crabbin.mp3',
    icon: '/assets/img/bossfights/cane.png',
    loop: {
        ...defaultLoop,
        start: timestampToSeconds('00:00:00.000'),
        end: timestampToSeconds('00:01:28.000')
    }
};