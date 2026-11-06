/**
 * The supplied leaderboard artworks, shown 1:1 (never redrawn), and where the live text sits on each.
 * Every slot is the inside of an outline drawn in the art, measured from the image in art pixels
 * (flood-filled from a seed point), then placed as a percentage so it tracks the art at any TV size.
 */
import pixelSky from '../assets/leaderboard/pixel-sky.webp';
import blockStack from '../assets/leaderboard/block-stack.webp';
import pixelForest from '../assets/leaderboard/pixel-forest.webp';
import arcadeMaze from '../assets/leaderboard/arcade-maze.webp';
import pixelSpace from '../assets/leaderboard/pixel-space.webp';

/** [left, top, right, bottom] in art pixels. */
export type Box = readonly [number, number, number, number];

export interface ArtLayout {
    src: string;
    width: number;
    height: number;
    /** Header: the title bar and clock box where the art has them, otherwise open sky. */
    title: Box;
    clock: Box;
    site: Box;
    /** Agent of the day panel. */
    aotdLabel: Box;
    aotdAvatar: Box;
    aotdName: Box;
    aotdSub: Box;
    stats: readonly [Box, Box];
    aotdBadges: readonly [Box, Box];
    /** Podium avatars and names, rank 1, 2, 3. */
    podiumAvatars: readonly [Box, Box, Box];
    podiumNames: readonly [Box, Box, Box];
    /** Badge pills under the podium as drawn in the art (rank 1: 3 pills, rank 2: 2, rank 3: 1). */
    podiumBadges: readonly { rank: 0 | 1 | 2; box: Box }[];
    listTitle: Box;
    rows: readonly Box[];
    /** Horizontal span of the yellow chip in each rank row (initials go there). */
    rowChip: readonly [number, number];
    queue: Box;
    /**
     * Where the initials go on the art's avatar: 'none' keeps the art's own picture (e.g. a "?" block),
     * 'center' fills a blank tile, 'cap' sits on the character's cap, 'bottom' on the tile's blank band.
     */
    initials: 'none' | 'center' | 'cap' | 'bottom';
    /** Icons the art already draws (so the page does not add its own). */
    drawn: { siteIcon: boolean; labelIcon: boolean; queueIcons: boolean; podiumPillIcons: boolean };
}

export const LEADERBOARD_ARTS = {
    pixelSky: {
        src: pixelSky, width: 1672, height: 941, initials: 'none', drawn: { siteIcon: false, labelIcon: false, queueIcons: false, podiumPillIcons: true },
        title: [31, 56, 782, 121], clock: [1451, 50, 1639, 110], site: [36, 14, 620, 48],
        aotdLabel: [65, 220, 402, 254], aotdAvatar: [165, 289, 321, 432], aotdName: [44, 446, 446, 492], aotdSub: [44, 494, 446, 526],
        stats: [[67, 548, 237, 663], [259, 548, 421, 663]], aotdBadges: [[67, 696, 181, 730], [205, 695, 421, 730]],
        podiumAvatars: [[748, 213, 858, 316], [529, 329, 613, 409], [978, 386, 1059, 461]],
        podiumNames: [[662, 326, 944, 434], [486, 418, 676, 522], [906, 470, 1122, 562]],
        podiumBadges: [
            { rank: 0, box: [700, 708, 892, 737] }, { rank: 0, box: [733, 748, 914, 777] }, { rank: 0, box: [727, 789, 892, 819] },
            { rank: 1, box: [599, 748, 677, 777] }, { rank: 1, box: [548, 789, 705, 819] }, { rank: 2, box: [914, 789, 1085, 819] },
        ],
        listTitle: [1166, 156, 1540, 200],
        rows: [[1166, 209, 1625, 257], [1166, 278, 1625, 327], [1166, 348, 1625, 396], [1166, 417, 1625, 465], [1166, 487, 1625, 535]],
        rowChip: [1221, 1272], queue: [26, 875, 1647, 921],
    },
    blockStack: {
        src: blockStack, width: 1672, height: 941, initials: 'center', drawn: { siteIcon: false, labelIcon: true, queueIcons: true, podiumPillIcons: true },
        title: [36, 46, 900, 112], clock: [1430, 44, 1650, 112], site: [36, 8, 620, 42],
        aotdLabel: [130, 215, 406, 251], aotdAvatar: [164, 274, 327, 424], aotdName: [36, 434, 462, 478], aotdSub: [36, 480, 462, 512],
        stats: [[58, 538, 233, 657], [256, 538, 431, 657]], aotdBadges: [[57, 684, 177, 719], [202, 684, 433, 719]],
        podiumAvatars: [[745, 190, 859, 289], [532, 302, 628, 386], [972, 339, 1064, 422]],
        podiumNames: [[676, 296, 930, 398], [486, 390, 690, 494], [906, 428, 1110, 524]],
        podiumBadges: [
            { rank: 0, box: [730, 722, 898, 749] }, { rank: 0, box: [729, 760, 897, 786] }, { rank: 0, box: [722, 796, 898, 825] },
            { rank: 1, box: [553, 751, 630, 778] }, { rank: 1, box: [485, 796, 680, 825] }, { rank: 2, box: [936, 796, 1107, 825] },
        ],
        listTitle: [1186, 160, 1524, 196],
        rows: [[1146, 218, 1628, 266], [1146, 284, 1628, 332], [1146, 352, 1628, 401], [1146, 421, 1628, 470], [1146, 489, 1628, 538]],
        rowChip: [1208, 1263], queue: [26, 863, 1645, 913],
    },
    pixelForest: {
        src: pixelForest, width: 1670, height: 941, initials: 'bottom', drawn: { siteIcon: false, labelIcon: false, queueIcons: false, podiumPillIcons: false },
        title: [76, 40, 940, 112], clock: [1430, 36, 1632, 108], site: [76, 6, 620, 42],
        aotdLabel: [69, 211, 421, 252], aotdAvatar: [176, 271, 340, 437], aotdName: [44, 446, 474, 492], aotdSub: [44, 492, 474, 524],
        stats: [[78, 541, 250, 666], [270, 541, 441, 666]], aotdBadges: [[68, 692, 193, 733], [216, 692, 452, 733]],
        podiumAvatars: [[744, 188, 864, 311], [544, 291, 637, 397], [976, 308, 1062, 408]],
        podiumNames: [[672, 316, 938, 420], [492, 404, 690, 508], [918, 416, 1120, 516]],
        podiumBadges: [
            { rank: 0, box: [704, 705, 902, 734] }, { rank: 0, box: [704, 747, 899, 776] }, { rank: 0, box: [704, 791, 901, 820] },
            { rank: 1, box: [528, 746, 638, 775] }, { rank: 1, box: [492, 791, 682, 820] }, { rank: 2, box: [923, 791, 1115, 820] },
        ],
        listTitle: [1159, 178, 1543, 212],
        rows: [[1143, 234, 1614, 282], [1143, 302, 1614, 350], [1143, 370, 1614, 419], [1143, 440, 1614, 489], [1143, 510, 1614, 559]],
        rowChip: [1201, 1253], queue: [85, 849, 1580, 897],
    },
    arcadeMaze: {
        src: arcadeMaze, width: 1672, height: 941, initials: 'cap', drawn: { siteIcon: true, labelIcon: false, queueIcons: false, podiumPillIcons: true },
        title: [52, 62, 880, 122], clock: [1430, 60, 1630, 120], site: [100, 24, 640, 58],
        aotdLabel: [68, 205, 420, 243], aotdAvatar: [173, 264, 343, 426], aotdName: [40, 432, 476, 476], aotdSub: [40, 478, 476, 510],
        stats: [[70, 527, 244, 640], [271, 526, 444, 640]], aotdBadges: [[66, 669, 189, 708], [212, 669, 450, 708]],
        podiumAvatars: [[743, 181, 848, 298], [539, 288, 625, 386], [967, 322, 1048, 414]],
        podiumNames: [[660, 300, 946, 400], [486, 388, 690, 488], [906, 416, 1110, 506]],
        podiumBadges: [
            { rank: 0, box: [687, 674, 913, 703] }, { rank: 0, box: [709, 718, 920, 743] }, { rank: 0, box: [705, 759, 883, 788] },
            { rank: 1, box: [537, 718, 652, 744] }, { rank: 1, box: [500, 759, 686, 788] }, { rank: 2, box: [902, 759, 1090, 788] },
        ],
        listTitle: [1140, 146, 1520, 184],
        rows: [[1126, 206, 1616, 256], [1126, 273, 1616, 321], [1126, 338, 1616, 386], [1126, 403, 1616, 451], [1126, 468, 1616, 517]],
        rowChip: [1190, 1248], queue: [44, 816, 1628, 860],
    },
    pixelSpace: {
        src: pixelSpace, width: 1672, height: 941, initials: 'cap', drawn: { siteIcon: true, labelIcon: false, queueIcons: true, podiumPillIcons: true },
        title: [36, 42, 900, 110], clock: [1450, 36, 1650, 104], site: [76, 6, 640, 42],
        aotdLabel: [65, 212, 419, 245], aotdAvatar: [165, 268, 337, 440], aotdName: [28, 446, 472, 494], aotdSub: [28, 494, 472, 526],
        stats: [[59, 550, 237, 676], [262, 550, 441, 676]], aotdBadges: [[59, 705, 179, 749], [203, 705, 442, 749]],
        podiumAvatars: [[752, 181, 850, 288], [553, 302, 641, 396], [958, 310, 1046, 408]],
        podiumNames: [[660, 292, 946, 400], [486, 396, 704, 500], [906, 416, 1110, 516]],
        podiumBadges: [
            { rank: 0, box: [697, 726, 900, 751] }, { rank: 0, box: [697, 766, 900, 791] }, { rank: 0, box: [698, 807, 899, 834] },
            { rank: 1, box: [525, 760, 640, 788] }, { rank: 1, box: [494, 806, 679, 835] }, { rank: 2, box: [918, 802, 1099, 832] },
        ],
        listTitle: [1127, 138, 1618, 180],
        rows: [[1139, 210, 1628, 261], [1139, 282, 1628, 332], [1139, 354, 1628, 404], [1139, 425, 1628, 476], [1139, 497, 1628, 548]],
        rowChip: [1195, 1252], queue: [23, 869, 1648, 914],
    },
} as const satisfies Record<string, ArtLayout>;

export type ArtTheme = keyof typeof LEADERBOARD_ARTS;

/** Percent position of a box on its art. */
export function boxStyle(b: Box, art: Pick<ArtLayout, 'width' | 'height'>): { left: string; top: string; width: string; height: string } {
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;
    return { left: pct(b[0], art.width), top: pct(b[1], art.height), width: pct(b[2] - b[0], art.width), height: pct(b[3] - b[1], art.height) };
}
