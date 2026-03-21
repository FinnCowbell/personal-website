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
            src: '/assets/img/bossfights/Favicon.png',
            type: 'image/png'
        }
    ]
});

export const songs = [
    {
        title: 'Fungal Floor',
        description: 'stiletto. boutique. catwalk. - MAY 2025',
        src: '/assets/music/boss-fights/Fungal Floor.mp3',
        icon: '/assets/img/bossfights/mushroom.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:00.000'),
            end: timestampToSeconds('00:02:05.042')
        }
    },
    {
        title: 'Mosh Potato',
        description: 'the stray punches feel directed - AUG 2024',
        src: '/assets/music/boss-fights/Bassaline.mp3',
        icon: '/assets/img/bossfights/crowd.png',
        loop: {
            ...defaultLoop,
            start: timestampToSeconds('00:00:12.468'),
            end: timestampToSeconds('00:03:38.182')
        }
    },
    {
        title: 'Apparatus',
        description: "breezes hit you - FEB 2025",
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
        description: "wrong turn again. - JAN 2025",
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
        description: 'intermission - JAN 2024',
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
        description: '*a bitcrushed crowd cheers you on* - APR 2025',
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
        description: "vermin attracted. prepare for battle. - JAN 2024",
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
        description: 'nothing to hide - MAY 2021',
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
        description: 'the rocks breathe - SEP 2023',
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
        description: 'past stays behind us - FEB 2025',
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
    description: 'Oy! Who let ya in the back room? - MAY 2020',
    src: '/assets/music/boss-fights/Crabbin.mp3',
    icon: '/assets/img/bossfights/cane.png',
    loop: {
        ...defaultLoop,
        start: timestampToSeconds('00:00:00.000'),
        end: timestampToSeconds('00:01:28.000')
    }
};