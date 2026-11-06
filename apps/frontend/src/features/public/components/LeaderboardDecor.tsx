import type { CSSProperties, ReactElement } from 'react';
import type { LeaderboardTheme } from '../utils/tvLeaderboard';

/**
 * Pixel sprite as rows of characters; each character is one pixel of the color in `palette`
 * ('.' is transparent). Drawn as crisp SVG rects so it stays sharp at any TV size.
 */
function Sprite({ rows, palette, size, className, style }: {
    rows: readonly string[]; palette: Record<string, string>; size: string; className?: string; style?: CSSProperties;
}) {
    const w = rows[0].length;
    const h = rows.length;
    return (
        <svg className={className} style={{ width: size, height: `calc(${size} * ${h / w})`, ...style }}
            viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
            {rows.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={palette[c]} />)))}
        </svg>
    );
}

const GHOST = [
    '....XXXXXX....',
    '..XXXXXXXXXX..',
    '.XXXXXXXXXXXX.',
    '.XXWWXXXXWWXX.',
    'XXWWWWXXWWWWXX',
    'XXWWBBXXWWBBXX',
    'XXWWBBXXWWBBXX',
    'XXXWWXXXXWWXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXX',
    'XX.XXX..XXX.XX',
    'X...XX..XX...X',
];
const PACMAN_OPEN = [
    '....XXXXX....',
    '..XXXXXXXXX..',
    '.XXXXXXXXXXX.',
    '.XXXXXXXXX...',
    'XXXXXXXX.....',
    'XXXXXX.......',
    'XXXX.........',
    'XXXXXX.......',
    'XXXXXXXX.....',
    '.XXXXXXXXX...',
    '.XXXXXXXXXXX.',
    '..XXXXXXXXX..',
    '....XXXXX....',
];
const INVADER = [
    '..X.....X..',
    '...X...X...',
    '..XXXXXXX..',
    '.XX.XXX.XX.',
    'XXXXXXXXXXX',
    'X.XXXXXXX.X',
    'X.X.....X.X',
    '...XX.XX...',
];
const CLOUD = [
    '......WWWW..........',
    '....WWWWWWWW...WWW..',
    '..WWWWWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWW',
    '.SSSSSSSSSSSSSSSSSS.',
];
const PIPE = [
    'DLLLLLLLLLLD',
    'DLLLLLLLLLLD',
    'DDDDDDDDDDDD',
    '.DLLLLLLLLD.',
    '.DLLLLLLLLD.',
    '.DLLLLLLLLD.',
    '.DLLLLLLLLD.',
    '.DLLLLLLLLD.',
];
const HEART = [
    '.RR.RR.',
    'RRRRRRR',
    'RRRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...',
];
const GEM = [
    '..GG..',
    '.GLLG.',
    'GLLGGG',
    'GGGGGG',
    '.GGGG.',
    '..GG..',
];
const BUSH = [
    '....GGGG....',
    '..GGLLGGGG..',
    '.GGLLGGGGGG.',
    'GGGGGGGGGGGG',
];
const TETROMINOES: Array<{ rows: string[]; color: string }> = [
    { rows: ['XX', 'XX'], color: '#FFD60A' },
    { rows: ['XXX.', '.X..'], color: '#C77DFF' },
    { rows: ['X..', 'XXX'], color: '#3A86FF' },
    { rows: ['.XX', 'XX.'], color: '#38E54D' },
    { rows: ['XXXX'], color: '#00E5FF' },
    { rows: ['XX.', '.XX'], color: '#FF4D4D' },
];

const ghost = (color: string) => ({ X: color, W: '#FFFFFF', B: '#1B3BFF' });

/** A ghost chase along one edge: pac-man eats the dots, ghosts follow. */
function MazeTrack({ edge }: { edge: 'top' | 'bottom' }) {
    return (
        <div className={`tv-lb-maze is-${edge}`} aria-hidden="true">
            <span className="tv-lb-maze-dots" />
            <div className="tv-lb-maze-runners">
                {edge === 'top' ? (
                    <>
                        <Sprite rows={PACMAN_OPEN} palette={{ X: '#FFE14D' }} size="2.4rem" className="tv-lb-chomp" />
                        <Sprite rows={GHOST} palette={ghost('#FF2E2E')} size="2.4rem" />
                        <Sprite rows={GHOST} palette={ghost('#FF8AD8')} size="2.4rem" />
                        <Sprite rows={GHOST} palette={ghost('#38F2FF')} size="2.4rem" />
                    </>
                ) : (
                    <>
                        <Sprite rows={GHOST} palette={ghost('#FF8AD8')} size="2.2rem" />
                        <Sprite rows={GHOST} palette={ghost('#FF9F1C')} size="2.2rem" />
                        <Sprite rows={GHOST} palette={ghost('#38F2FF')} size="2.2rem" />
                    </>
                )}
            </div>
        </div>
    );
}

function ArcadeMaze() {
    return <><MazeTrack edge="top" /><MazeTrack edge="bottom" /></>;
}

function PixelSky() {
    const cloud = { W: '#FFFFFF', S: '#C9E8FF' };
    const pipe = { D: '#0E6B1F', L: '#3BD15A' };
    const bush = { G: '#1E9C35', L: '#52E06B' };
    return (
        <>
            <Sprite rows={CLOUD} palette={cloud} size="9rem" className="tv-lb-cloud is-a" />
            <Sprite rows={CLOUD} palette={cloud} size="7rem" className="tv-lb-cloud is-b" />
            <Sprite rows={CLOUD} palette={cloud} size="5.5rem" className="tv-lb-cloud is-c" />
            <Sprite rows={PIPE} palette={pipe} size="4.2rem" className="tv-lb-pipe is-left" />
            <Sprite rows={PIPE} palette={pipe} size="4.2rem" className="tv-lb-pipe is-right" />
            <Sprite rows={BUSH} palette={bush} size="5rem" className="tv-lb-bush is-left" />
            <Sprite rows={BUSH} palette={bush} size="4rem" className="tv-lb-bush is-right" />
            <span className="tv-lb-ground" aria-hidden="true" />
        </>
    );
}

function PixelSpace() {
    return (
        <div className="tv-lb-invaders" aria-hidden="true">
            {['#38F2FF', '#FF3CC7', '#38F2FF', '#FF3CC7', '#38F2FF'].map((color, i) => (
                <Sprite key={i} rows={INVADER} palette={{ X: color }} size="3rem" className={`tv-lb-invader is-${i}`} />
            ))}
        </div>
    );
}

function BlockStack() {
    return (
        <div className="tv-lb-blocks" aria-hidden="true">
            {TETROMINOES.map((t, i) => (
                <Sprite key={i} rows={t.rows} palette={{ X: t.color }} size={`${t.rows[0].length * 1.6}rem`} className={`tv-lb-tetro is-${i}`} />
            ))}
        </div>
    );
}

function PixelForest() {
    return (
        <>
            <span className="tv-lb-leaves is-left" aria-hidden="true" />
            <span className="tv-lb-leaves is-right" aria-hidden="true" />
            <span className="tv-lb-ground is-forest" aria-hidden="true" />
        </>
    );
}

/** Ornaments pinned to the two side panels (hearts and a gem in the forest). */
export function PanelOrnaments({ theme }: { theme: LeaderboardTheme }) {
    if (theme !== 'pixelForest') return null;
    const heart = { R: '#FF3B5C' };
    const gem = { G: '#11B864', L: '#9BFFC9' };
    return (
        <span className="tv-lb-ornaments" aria-hidden="true">
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                <Sprite key={corner} rows={HEART} palette={heart} size="1.9rem" className={`tv-lb-heart is-${corner}`} />
            ))}
            <Sprite rows={GEM} palette={gem} size="1.6rem" className="tv-lb-gem is-top" />
            <Sprite rows={GEM} palette={gem} size="1.6rem" className="tv-lb-gem is-bottom" />
        </span>
    );
}

/** Glowing traces that run along the screen edges, a pulse travelling along them. */
function NeonCircuit() {
    const paths = [
        'M0 70 H260 L300 40 H700',
        'M1100 40 H1500 L1540 70 H1920',
        'M0 1010 H420 L460 1040 H1200 L1240 1010 H1920',
        'M40 300 V700',
        'M1880 260 V760',
    ];
    return (
        <svg className="tv-lb-circuit" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
            {paths.map((d, i) => (
                <g key={i}>
                    <path d={d} className="is-trace" />
                    <path d={d} className="is-pulse" style={{ animationDelay: `${i * 0.7}s` }} />
                </g>
            ))}
            {[[300, 40], [1540, 70], [460, 1040], [1240, 1010], [40, 300], [1880, 760]].map(([x, y], i) => (
                <rect key={i} x={x - 6} y={y - 6} width="12" height="12" className="is-node" />
            ))}
        </svg>
    );
}

function HexTech() {
    return <span className="tv-lb-hexgrid" aria-hidden="true" />;
}

function MechaSteel() {
    return (
        <>
            <span className="tv-lb-hazard is-top" aria-hidden="true" />
            <span className="tv-lb-lights is-left" aria-hidden="true" />
            <span className="tv-lb-lights is-right" aria-hidden="true" />
        </>
    );
}

function Racing() {
    return (
        <>
            <span className="tv-lb-speed is-top" aria-hidden="true" />
            <span className="tv-lb-speed is-bottom" aria-hidden="true" />
            <span className="tv-lb-flag is-left" aria-hidden="true" />
            <span className="tv-lb-flag is-right" aria-hidden="true" />
        </>
    );
}

const DECOR: Record<LeaderboardTheme, () => ReactElement> = {
    arcadeMaze: ArcadeMaze,
    pixelSky: PixelSky,
    pixelSpace: PixelSpace,
    blockStack: BlockStack,
    pixelForest: PixelForest,
    neonCircuit: NeonCircuit,
    hexTech: HexTech,
    mechaSteel: MechaSteel,
    racing: Racing,
};

/** Background decoration of the day's look, behind every panel. */
export function LeaderboardDecor({ theme }: { theme: LeaderboardTheme }) {
    const Decor = DECOR[theme];
    return <div className="tv-lb-decor" aria-hidden="true"><Decor /></div>;
}
