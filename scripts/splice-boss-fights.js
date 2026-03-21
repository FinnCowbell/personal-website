#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { secretSong, songs } from '../content/static/player-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const generatedModulePath = path.join(repoRoot, 'content/static/player-segments.generated.js');
const segmentsRoot = path.join(repoRoot, 'assets/music/boss-fights/segments');
const epsilon = 0.001;
const checkOnly = process.argv.includes('--check');

const tracks = [...songs, secretSong];

function slugifyTitle(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        encoding: 'utf8'
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(result.stderr.trim() || `${command} exited with status ${result.status}`);
    }

    return result.stdout.trim();
}

function ensureToolAvailable(toolName) {
    runCommand(toolName, ['-version']);
}

function getTrackDurationSeconds(absoluteInputPath) {
    const stdout = runCommand('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        absoluteInputPath
    ]);
    const duration = Number.parseFloat(stdout);
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error(`Unable to read duration for ${absoluteInputPath}`);
    }

    return duration;
}

function segmentFileExists(filePath) {
    try {
        const stat = fs.statSync(filePath);
        return stat.isFile() && stat.size > 0;
    } catch {
        return false;
    }
}

function writeSegment({ inputPath, outputPath, start, duration }) {
    runCommand('ffmpeg', [
        '-y',
        '-v', 'error',
        '-i', inputPath,
        '-ss', start.toFixed(6),
        '-t', duration.toFixed(6),
        '-vn',
        '-map_metadata', '-1',
        '-movflags', '+faststart',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputPath
    ]);
}

function buildSegmentsForTrack(track) {
    const absoluteInputPath = path.join(repoRoot, track.src.replace(/^\//, ''));
    const totalDuration = getTrackDurationSeconds(absoluteInputPath);
    const loopStart = Number(track.loop?.start ?? 0);
    const loopEnd = Number(track.loop?.end ?? totalDuration);

    if (!Number.isFinite(loopStart) || !Number.isFinite(loopEnd)) {
        throw new Error(`Track ${track.title} has invalid loop markers`);
    }

    if (loopStart < 0 || loopEnd <= loopStart || loopEnd > totalDuration + epsilon) {
        throw new Error(`Track ${track.title} has out-of-range loop markers`);
    }

    const segmentId = slugifyTitle(track.title);
    const outputDir = path.join(segmentsRoot, segmentId);
    const publicBase = `/assets/music/boss-fights/segments/${segmentId}`;
    const introDuration = Math.max(loopStart, 0);
    const loopDuration = loopEnd - loopStart;
    const outroDuration = Math.max(totalDuration - loopEnd, 0);
    const metadata = {
        introEnd: loopStart,
        loopStart,
        loopEnd,
        totalDuration
    };
    const outputs = [];

    if (introDuration > epsilon) {
        metadata.introSrc = `${publicBase}/intro.m4a`;
        outputs.push({
            absolutePath: path.join(outputDir, 'intro.m4a'),
            start: 0,
            duration: introDuration
        });
    }

    metadata.loopSrc = `${publicBase}/loop.m4a`;
    outputs.push({
        absolutePath: path.join(outputDir, 'loop.m4a'),
        start: loopStart,
        duration: loopDuration
    });

    if (outroDuration > epsilon) {
        metadata.outroSrc = `${publicBase}/outro.m4a`;
        outputs.push({
            absolutePath: path.join(outputDir, 'outro.m4a'),
            start: loopEnd,
            duration: outroDuration
        });
    }

    return {
        title: track.title,
        src: track.src,
        inputPath: absoluteInputPath,
        outputDir,
        metadata,
        outputs
    };
}

function formatNumber(value) {
    return Number(value.toFixed(6));
}

function buildGeneratedModule(entries) {
    const sortedEntries = [...entries].sort((left, right) => left.src.localeCompare(right.src));
    const lines = [
        'export const segmentMetadataBySrc = Object.freeze({'
    ];

    for (const entry of sortedEntries) {
        lines.push(`    '${entry.src}': Object.freeze({`);
        for (const [key, value] of Object.entries(entry.metadata)) {
            if (typeof value === 'number') {
                lines.push(`        ${key}: ${formatNumber(value)},`);
            } else {
                lines.push(`        ${key}: '${value}',`);
            }
        }
        lines.push('    }),');
    }

    lines.push('});');
    lines.push('');
    return lines.join('\n');
}

function run() {
    ensureToolAvailable('ffmpeg');
    ensureToolAvailable('ffprobe');

    const entries = tracks.map(buildSegmentsForTrack);
    const generatedModuleText = buildGeneratedModule(entries);

    if (checkOnly) {
        const existingGeneratedModule = fs.existsSync(generatedModulePath)
            ? fs.readFileSync(generatedModulePath, 'utf8')
            : '';

        if (existingGeneratedModule !== generatedModuleText) {
            throw new Error('Generated segment metadata module is out of date');
        }

        const missingOutputs = [];
        for (const entry of entries) {
            for (const output of entry.outputs) {
                if (!segmentFileExists(output.absolutePath)) {
                    missingOutputs.push(path.relative(repoRoot, output.absolutePath));
                }
            }
        }

        if (missingOutputs.length > 0) {
            throw new Error(`Missing generated segment files:\n${missingOutputs.join('\n')}`);
        }

        console.info('BOSS FIGHTS segments are up to date');
        return;
    }

    for (const entry of entries) {
        fs.mkdirSync(entry.outputDir, { recursive: true });
        for (const output of entry.outputs) {
            console.info(`Splicing ${entry.title}: ${path.basename(output.absolutePath)}`);
            writeSegment({
                inputPath: entry.inputPath,
                outputPath: output.absolutePath,
                start: output.start,
                duration: output.duration
            });
        }
    }

    fs.writeFileSync(generatedModulePath, generatedModuleText, 'utf8');
    console.info('Wrote content/static/player-segments.generated.js');
}

try {
    run();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}