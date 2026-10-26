/**
 * The backend reorder endpoints need EVERY id of the scope (including inactive ones the admin currently hides).
 * The visible ids are placed in their new relative order into the slots they already occupy; hidden ids stay put.
 */
export function mergeVisibleOrder(allIds: readonly string[], visibleIdsNewOrder: readonly string[]): string[] {
    const known = new Set(allIds);
    const visible = visibleIdsNewOrder.filter((id) => known.has(id));
    const visibleSet = new Set(visible);
    let cursor = 0;
    return allIds.map((id) => visibleSet.has(id) ? visible[cursor++] : id);
}
