import type { CSSProperties, ReactNode } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getImageUrl } from '@/components/ui/UserAvatar';
import { LeaderboardEffects } from './LeaderboardEffects';
import { BADGES, initialsOf, leaderboardOwner, minutesLabel, titleName, type BadgeKey, type LeaderboardAgent, type TvLeaderboardData } from '../utils/tvLeaderboard';
import { boxStyle, LEADERBOARD_ARTS, type ArtTheme, type Box } from '../utils/leaderboardArt';

interface TvLeaderboardArtProps {
    theme: ArtTheme;
    data: TvLeaderboardData;
    siteName: string;
    time: string;
    queue: { open: number; inProgress: number; overdue: number };
}

/** The badge each pill of the art stands for, by the icon drawn on it (podium rank 1, 2, 3). */
const PODIUM_PILL_BADGES: Record<0 | 1 | 2, BadgeKey[]> = {
    0: ['champion', 'perfectSla', 'criticalSolver'],
    1: ['fastest', 'responsive'],
    2: ['favorite'],
};
const AOTD_PILL_BADGES: BadgeKey[] = ['fastest', 'responsive'];

/** Stable slot component: board refreshes update text without remounting it. */
function Slot({ art, box, className, children, style }: {
    art: { width: number; height: number }; box: Box; className?: string; children?: ReactNode; style?: CSSProperties;
}) {
    return <div className={cn('tv-lba-slot', className)} style={{ ...boxStyle(box, art), ...style }}>{children}</div>;
}

/**
 * The day's artwork shown 1:1 with the live numbers laid into its blank slots, plus light motion
 * on top (glints, bobbing avatars, the day's particles). The art itself is never redrawn.
 */
export function TvLeaderboardArt({ theme, data, siteName, time, queue }: TvLeaderboardArtProps) {
    const art = LEADERBOARD_ARTS[theme];
    const at = (b: Box) => boxStyle(b, art);
    const aotd = data.agentOfTheDay?.agent ?? null;
    const top = data.topAgents;

    const pillText = (agent: LeaderboardAgent | undefined, key: BadgeKey) => (agent?.badges.includes(key) ? BADGES[key].label : '');

    return (
        <div className={cn('tv-lba', `tv-lba-${theme}`)} data-testid="tv-leaderboard" data-lb-theme={theme}>
            <div className="tv-lba-stage" style={{ aspectRatio: `${art.width} / ${art.height}` }}>
                <img className="tv-lba-art" src={art.src} alt="" draggable={false} />
                <LeaderboardEffects theme={theme} />
                <span className="tv-lba-glint" aria-hidden="true" />

                {/* Header */}
                <Slot art={art} box={art.site} className={cn('is-site', art.drawn.siteIcon && 'has-art-icon')}>{art.drawn.siteIcon ? '' : '🏆 '}{leaderboardOwner(siteName)}</Slot>
                <Slot art={art} box={art.title} className="is-title"><h1>Top Agent <span>{data.monthLabel}</span></h1></Slot>
                <Slot art={art} box={art.clock} className="is-clock">{time}</Slot>

                {/* Agent of the day */}
                <Slot art={art} box={art.aotdLabel} className={cn('is-label', art.drawn.labelIcon && 'has-art-icon')}>{art.drawn.labelIcon ? '' : '👑 '}Agent of the Day</Slot>
                {aotd && (
                    <>
                        <Avatar box={art.aotdAvatar} agent={aotd} mode={art.initials} at={at} art={art} big />
                        <Slot art={art} box={art.aotdName} className="is-name is-big">{titleName(aotd.name)}</Slot>
                        <Slot art={art} box={art.aotdSub} className="is-sub">
                            {data.agentOfTheDay?.period === 'today' ? `${aotd.resolved} tiket selesai hari ini` : `Juara hari kerja terakhir · ${aotd.resolved} tiket`}
                        </Slot>
                        <Slot art={art} box={art.stats[0]} className="is-stat"><b>{aotd.slaRate == null ? '—' : `${aotd.slaRate}%`}</b><small>Tepat SLA</small></Slot>
                        <Slot art={art} box={art.stats[1]} className="is-stat"><b>{minutesLabel(aotd.avgResolutionMinutes)}</b><small>Rata-rata</small></Slot>
                        {art.aotdBadges.map((b, i) => <Slot art={art} key={i} box={b} className="is-pill">{pillText(aotd, AOTD_PILL_BADGES[i])}</Slot>)}
                    </>
                )}

                {/* Podium */}
                {([0, 1, 2] as const).map((rank) => {
                    const agent = top[rank];
                    if (!agent) return null;
                    return (
                        <div key={agent.agentId} className="tv-lba-rank" style={{ animationDelay: `${0.25 + (2 - rank) * 0.3}s` }}>
                            <Avatar box={art.podiumAvatars[rank]} agent={agent} mode={art.initials} at={at} art={art} bob />
                            <Slot art={art} box={art.podiumNames[rank]} className="is-podium-name">
                                <b>{titleName(agent.name)}</b>
                                <span><b>{agent.resolved}</b> tiket</span>
                            </Slot>
                        </div>
                    );
                })}
                {art.podiumBadges.map(({ rank, box }, i) => {
                    const slot = art.podiumBadges.slice(0, i).filter((p) => p.rank === rank).length;
                    const key = PODIUM_PILL_BADGES[rank][slot];
                    // Without a drawn icon on the art, the badge brings its own.
                    return (
                        <Slot art={art} key={i} box={box} className={cn('is-pill', !art.drawn.podiumPillIcons && 'is-plain')}>
                            {top[rank]?.badges.includes(key) ? <>{art.drawn.podiumPillIcons ? '' : `${BADGES[key].emoji} `}{BADGES[key].label}</> : ''}
                        </Slot>
                    );
                })}

                {/* Ranks 4-8: the art has five rows */}
                <Slot art={art} box={art.listTitle} className="is-label is-list-title">Peringkat lainnya</Slot>
                {art.rows.map((row, i) => {
                    const agent = top[i + 3];
                    if (!agent) return null;
                    const chip: Box = [art.rowChip[0], row[1], art.rowChip[1], row[3]];
                    const after: Box = [art.rowChip[1] + 12, row[1], row[2] - 10, row[3]];
                    const before: Box = [row[0] + 6, row[1], art.rowChip[0] - 6, row[3]];
                    return (
                        <div key={agent.agentId} className="tv-lba-row" style={{ animationDelay: `${1.1 + i * 0.12}s` }}>
                            <Slot art={art} box={before} className="is-rank-no">{i + 4}</Slot>
                            <Slot art={art} box={chip} className="is-chip">{initialsOf(agent.name)}</Slot>
                            <Slot art={art} box={after} className="is-row">
                                <span className="is-row-name">{titleName(agent.name)}</span>
                                {agent.rating != null && <span className="is-row-rating"><Star aria-hidden="true" />{agent.rating.toFixed(1)}</span>}
                                <b className="is-row-count">{agent.resolved}</b>
                            </Slot>
                        </div>
                    );
                })}

                {/* Queue strip */}
                <Slot art={art} box={art.queue} className={cn('is-queue', art.drawn.queueIcons && 'has-art-icons')}>
                    <span className="is-q-open">{art.drawn.queueIcons ? '' : '📥 '}Open <b>{queue.open}</b></span>
                    <span className="is-q-progress">{art.drawn.queueIcons ? '' : '⏱ '}In Progress <b>{queue.inProgress}</b></span>
                    <span className={cn('is-q-overdue', queue.overdue > 0 && 'is-bad')}>{art.drawn.queueIcons ? '' : '⚠ '}Overdue <b>{queue.overdue}</b></span>
                    <span className="is-note">Papan antrean kembali pukul 13.00</span>
                </Slot>

                {top.length === 0 && !aotd && (
                    <div className="tv-lba-empty">Belum ada tiket yang selesai bulan ini. Ayo jadi yang pertama di papan juara!</div>
                )}
            </div>
        </div>
    );
}

/**
 * The art's avatar stays as drawn; it only gets the agent's initials where the art leaves room
 * (blank tile, cap, bottom band), and moves (bob) with the leader. A photo replaces only a blank tile.
 */
function Avatar({ box, agent, mode, at, art, big, bob }: {
    box: Box; agent: LeaderboardAgent; mode: 'none' | 'center' | 'cap' | 'bottom'; at: (b: Box) => CSSProperties;
    art: { src: string; width: number; height: number }; big?: boolean; bob?: boolean;
}) {
    const url = agent.avatarUrl && mode === 'center' ? getImageUrl(agent.avatarUrl) : null;
    // The tile moves as a cut of the very same art (same pixels), so the drawn character bobs too.
    const w = box[2] - box[0];
    const h = box[3] - box[1];
    const cut: CSSProperties = {
        backgroundImage: `url(${art.src})`,
        backgroundSize: `${(art.width / w) * 100}% ${(art.height / h) * 100}%`,
        backgroundPosition: `${(box[0] / (art.width - w)) * 100}% ${(box[1] / (art.height - h)) * 100}%`,
    };
    return (
        <div className={cn('tv-lba-avatar', `is-${mode}`, big && 'is-big', bob && 'is-bob')} style={at(box)}>
            <div className="tv-lba-avatar-cut" style={cut}>
                {url ? <img src={url} alt="" /> : mode !== 'none' && <span>{initialsOf(agent.name)}</span>}
            </div>
        </div>
    );
}
