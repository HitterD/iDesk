import { AlertTriangle, CircleDot, Clock, Crown, Inbox, Star, Target, Trophy } from 'lucide-react';
import { getImageUrl } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import { LeaderboardEffects } from './LeaderboardEffects';
import {
    BADGES, initialsOf, minutesLabel, themeForDate, titleName,
    type LeaderboardAgent, type TvLeaderboardData,
} from '../utils/tvLeaderboard';

const PODIUM_ORDER = [1, 0, 2] as const; // silver, gold, bronze, left to right
/** Metal of each podium rank; the CSS draws the coin rim and the brushed block per metal. */
const METAL = ['gold', 'silver', 'bronze'] as const;
type Metal = (typeof METAL)[number];
const MEDAL_LABEL = ['Juara 1', 'Juara 2', 'Juara 3'];

/** Agent photo or initials struck on a medal coin: metal rim, bevel and a sheen. */
function Avatar({ agent, size, metal = 'gold' }: { agent: LeaderboardAgent; size: string; metal?: Metal }) {
    const url = agent.avatarUrl ? getImageUrl(agent.avatarUrl) : null;
    return (
        <span className={cn('tv-lb-coin', size, `is-${metal}`)}>
            <span className="tv-lb-coin-face">{url ? <img src={url} alt="" /> : initialsOf(agent.name)}</span>
        </span>
    );
}

function Badges({ agent, big }: { agent: LeaderboardAgent; big?: boolean }) {
    if (agent.badges.length === 0) return null;
    return (
        <div className={cn('tv-lb-badges', big && 'is-big')}>
            {agent.badges.map((key) => (
                <span key={key} className="tv-lb-badge" title={BADGES[key].hint}>
                    <span aria-hidden="true">{BADGES[key].emoji}</span>{BADGES[key].label}
                </span>
            ))}
        </div>
    );
}

function Stat({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
    return (
        <span className="tv-lb-stat">
            <Icon aria-hidden="true" />
            <b>{value}</b>
            <small>{label}</small>
        </span>
    );
}

function AgentOfTheDayCard({ data }: { data: NonNullable<TvLeaderboardData['agentOfTheDay']> }) {
    const { agent } = data;
    return (
        <section className="tv-lb-aotd" aria-label="Agent of the Day">
            <span className="tv-lb-eyebrow"><Crown aria-hidden="true" />Agent of the Day</span>
            <Avatar agent={agent} size="is-xl" />
            <h2>{titleName(agent.name)}</h2>
            <p className="tv-lb-sub">
                {data.period === 'today' ? `${agent.resolved} tiket selesai hari ini` : `Juara hari kerja terakhir · ${agent.resolved} tiket`}
            </p>
            <div className="tv-lb-stats">
                <Stat icon={Target} value={agent.slaRate == null ? '—' : `${agent.slaRate}%`} label="Tepat SLA" />
                <Stat icon={Clock} value={minutesLabel(agent.avgResolutionMinutes)} label="Rata-rata" />
            </div>
            <Badges agent={agent} big />
        </section>
    );
}

function Podium({ agents }: { agents: LeaderboardAgent[] }) {
    return (
        <section className="tv-lb-podium" aria-label="Top 3 bulan ini">
            <span className="tv-lb-stage" aria-hidden="true" />
            {PODIUM_ORDER.map((rank) => {
                const agent = agents[rank];
                if (!agent) return <div key={rank} className="tv-lb-step is-empty" />;
                return (
                    <div key={agent.agentId} className={cn('tv-lb-step', `is-rank-${rank + 1}`)} style={{ animationDelay: `${(2 - rank) * 0.35}s` }}>
                        {rank === 0 && <Crown className="tv-lb-crown" aria-hidden="true" />}
                        <Avatar agent={agent} size={rank === 0 ? 'is-lg' : 'is-md'} metal={METAL[rank]} />
                        <b className="tv-lb-name">{titleName(agent.name)}</b>
                        <span className="tv-lb-count"><b>{agent.resolved}</b> tiket</span>
                        <div className={cn('tv-lb-block', `is-${METAL[rank]}`)}>
                            <span className="tv-lb-medal">{rank + 1}</span>
                            <small>{MEDAL_LABEL[rank]}</small>
                        </div>
                        <Badges agent={agent} />
                    </div>
                );
            })}
        </section>
    );
}

function RankList({ agents }: { agents: LeaderboardAgent[] }) {
    if (agents.length === 0) return null;
    return (
        <section className="tv-lb-list" aria-label="Peringkat 4 sampai 10">
            <h3>Peringkat lainnya</h3>
            <ol start={4}>
                {agents.map((agent, i) => (
                    <li key={agent.agentId} style={{ animationDelay: `${1.2 + i * 0.12}s` }}>
                        <span className="tv-lb-rank">{i + 4}</span>
                        <Avatar agent={agent} size="is-sm" />
                        <span className="tv-lb-list-name">{titleName(agent.name)}</span>
                        {agent.rating != null && <span className="tv-lb-rating"><Star aria-hidden="true" />{agent.rating.toFixed(1)}</span>}
                        <span className="tv-lb-list-count">{agent.resolved}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

interface TvLeaderboardProps {
    data: TvLeaderboardData;
    siteName: string;
    time: string;
    queue: { open: number; inProgress: number; overdue: number };
}

/** The 12:00-13:00 view: agent of the day, the month's podium and ranks, badges, the day's animation. */
export function TvLeaderboard({ data, siteName, time, queue }: TvLeaderboardProps) {
    const theme = themeForDate(data.dateKey);
    return (
        <div className={cn('tv-lb', `tv-lb-theme-${theme}`)} data-testid="tv-leaderboard" data-lb-theme={theme}>
            <LeaderboardEffects theme={theme} />
            <header className="tv-lb-head">
                <div>
                    <span className="tv-lb-eyebrow"><Trophy aria-hidden="true" />{siteName}</span>
                    <h1>Top Agent <span>{data.monthLabel}</span></h1>
                </div>
                <div className="tv-lb-clock">{time}</div>
            </header>

            {data.topAgents.length === 0 && !data.agentOfTheDay ? (
                <div className="tv-lb-empty">
                    <Trophy aria-hidden="true" />
                    <p>Belum ada tiket yang selesai bulan ini. Ayo jadi yang pertama di papan juara!</p>
                </div>
            ) : (
                <div className="tv-lb-grid">
                    {data.agentOfTheDay ? <AgentOfTheDayCard data={data.agentOfTheDay} /> : <div />}
                    <Podium agents={data.topAgents.slice(0, 3)} />
                    <RankList agents={data.topAgents.slice(3, 10)} />
                </div>
            )}

            <footer className="tv-lb-queue" aria-label="Antrean saat ini">
                <span><Inbox aria-hidden="true" />Open <b>{queue.open}</b></span>
                <span><CircleDot aria-hidden="true" />In Progress <b>{queue.inProgress}</b></span>
                {queue.overdue > 0 && <span className="is-bad"><AlertTriangle aria-hidden="true" />Overdue <b>{queue.overdue}</b></span>}
                <span className="tv-lb-queue-note">Papan antrean kembali pukul 13.00</span>
            </footer>
        </div>
    );
}
