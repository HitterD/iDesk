/**
 * Runs `work` for every item with at most `limit` running at once. A failing item is skipped,
 * not rethrown, so one bad item never stops the rest; callers log failures inside `work`.
 * Used to keep notification fan-out from opening hundreds of requests/queries at the same time.
 */
export async function forEachWithConcurrency<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const runner = async (): Promise<void> => {
        while (next < items.length) {
            const item = items[next++];
            await work(item).catch(() => undefined);
        }
    };
    await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, runner));
}
