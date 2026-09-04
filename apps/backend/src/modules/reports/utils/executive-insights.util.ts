/**
 * Executive Insights Utility
 * Generates automated smart executive takeaways & key findings for iDesk Reports
 */

export interface ReportInsightInput {
    periodLabel?: string;
    totalTickets?: number;
    resolvedTickets?: number;
    openTickets?: number;
    resolutionRate?: number;
    avgResolutionTimeHours?: number | string;
    avgResponseTimeMinutes?: number | string;
    slaComplianceRate?: number;
    breachedTickets?: number;
    byPriority?: Record<string, number>;
    byCategory?: Record<string, number>;
    byStatus?: Record<string, number>;
    topPerformer?: { name: string; resolutionRate?: number; count?: number };
    topSite?: { name: string; complianceRate?: number; count?: number };
    siteCount?: number;
    agentCount?: number;
}

/**
 * Generate 3-5 structured executive takeaways from report data
 */
export function generateExecutiveInsights(data: ReportInsightInput): string[] {
    const insights: string[] = [];

    const total = Number(data.totalTickets) || 0;
    const resolved = Number(data.resolvedTickets) || 0;
    const open = Number(data.openTickets) || Math.max(0, total - resolved);
    const resRate = data.resolutionRate !== undefined
        ? Number(data.resolutionRate)
        : total > 0 ? (resolved / total) * 100 : 0;

    const slaRate = data.slaComplianceRate !== undefined ? Number(data.slaComplianceRate) : null;
    const avgResHours = parseFloat(String(data.avgResolutionTimeHours || 0));

    // 1. Overall Volume & Resolution Rate
    if (total === 0) {
        insights.push('Tidak ada aktivitas tiket yang tercatat pada periode laporan ini.');
        return insights;
    }

    let volumeInsight = `Total ${total.toLocaleString('id-ID')} tiket tercatat pada periode ini dengan tingkat penyelesaian ${resRate.toFixed(1)}% (${resolved.toLocaleString('id-ID')} tiket terselesaikan, ${open.toLocaleString('id-ID')} masih aktif/berjalan).`;
    if (resRate >= 90) {
        volumeInsight += ' Produktivitas penyelesaian tiket berada pada zona sangat optimal.';
    } else if (resRate >= 75) {
        volumeInsight += ' Produktivitas penyelesaian tiket berada dalam batas normal stabil.';
    } else {
        volumeInsight += ' Diperlukan monitoring tambahan untuk mempercepat penyelesaian antrean tiket terbuka.';
    }
    insights.push(volumeInsight);

    // 2. SLA Compliance & Response/Resolution Times
    if (slaRate !== null && !isNaN(slaRate)) {
        let slaInsight = `Tingkat kepatuhan Service Level Agreement (SLA) mencapai ${slaRate.toFixed(1)}%`;
        if (data.breachedTickets && data.breachedTickets > 0) {
            slaInsight += ` dengan ${data.breachedTickets} tiket melewati batas SLA.`;
        } else {
            slaInsight += ` tanpa adanya pelanggaran SLA mayor.`;
        }

        if (!isNaN(avgResHours) && avgResHours > 0) {
            slaInsight += ` Rata-rata waktu penyelesaian tiket adalah ${avgResHours.toFixed(1)} jam.`;
        }
        insights.push(slaInsight);
    } else if (!isNaN(avgResHours) && avgResHours > 0) {
        insights.push(`Rata-rata waktu penyelesaian tiket adalah ${avgResHours.toFixed(1)} jam per tiket.`);
    }

    // 3. Category & Priority Distribution Highlights
    if (data.byCategory && Object.keys(data.byCategory).length > 0) {
        const sortedCategories = Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]);
        const topCat = sortedCategories[0];
        if (topCat && topCat[1] > 0) {
            const catPct = ((topCat[1] / total) * 100).toFixed(1);
            let catInsight = `Kategori permintaan terbanyak adalah "${topCat[0]}" dengan ${topCat[1]} tiket (${catPct}% dari total volume).`;

            if (data.byPriority) {
                const urgentCount = (data.byPriority['CRITICAL'] || 0) + (data.byPriority['URGENT'] || 0) + (data.byPriority['HIGH'] || 0);
                if (urgentCount > 0) {
                    const urgentPct = ((urgentCount / total) * 100).toFixed(1);
                    catInsight += ` Sebanyak ${urgentCount} tiket (${urgentPct}%) berkategori prioritas High/Critical yang memerlukan respon cepat.`;
                }
            }
            insights.push(catInsight);
        }
    }

    // 4. Performer & Site Highlights
    if (data.topPerformer && data.topPerformer.name) {
        let perfInsight = `Agent dengan kontribusi performa tertinggi: ${data.topPerformer.name}`;
        if (data.topPerformer.resolutionRate !== undefined) {
            perfInsight += ` (Resolution Rate: ${data.topPerformer.resolutionRate.toFixed(1)}%)`;
        } else if (data.topPerformer.count !== undefined) {
            perfInsight += ` (${data.topPerformer.count} tiket terselesaikan)`;
        }
        perfInsight += '.';
        insights.push(perfInsight);
    } else if (data.topSite && data.topSite.name) {
        let siteInsight = `Lokasi operasional utama: ${data.topSite.name}`;
        if (data.topSite.complianceRate !== undefined) {
            siteInsight += ` dengan kepatuhan SLA ${data.topSite.complianceRate.toFixed(1)}%`;
        }
        siteInsight += '.';
        insights.push(siteInsight);
    }

    // Fallback if less than 2 insights
    if (insights.length < 2) {
        insights.push('Seluruh metrik operasional dan performa teknisi terlampir pada rincian tabel di bawah.');
    }

    return insights.slice(0, 4);
}
