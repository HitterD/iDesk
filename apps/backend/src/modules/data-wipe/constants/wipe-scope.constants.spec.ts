import {
    COUNTER_RESETS,
    FORBIDDEN_TABLES,
    WipeDomain,
    allWipableTables,
    assertWipeScopeIntegrity,
    buildWipePlan,
} from './wipe-scope.constants';

describe('wipe-scope constants', () => {
    describe('protected tables', () => {
        it('never lists a protected table as wipable', () => {
            const overlap = allWipableTables().filter((t) => FORBIDDEN_TABLES.includes(t));
            expect(overlap).toEqual([]);
        });

        it('passes the integrity assertion used at module construction', () => {
            expect(() => assertWipeScopeIntegrity()).not.toThrow();
        });

        it('protects users, audit logs and the Synology backup tables', () => {
            for (const table of ['users', 'audit_logs', 'backup_configurations', 'backup_history']) {
                expect(FORBIDDEN_TABLES).toContain(table);
            }
        });

        it('protects master data for all three domains', () => {
            for (const table of [
                'ticket_attributes',
                'ticket_modules',
                'sla_configs',
                'hardware_catalog',
            ]) {
                expect(FORBIDDEN_TABLES).toContain(table);
            }
        });

        it('keeps counter-reset tables out of the delete plan', () => {
            const wipable = allWipableTables();
            for (const counter of COUNTER_RESETS) {
                expect(wipable).not.toContain(counter.table);
            }
        });
    });

    describe('delete order', () => {
        const orderOf = (plan: { table: string }[], table: string) =>
            plan.findIndex((s) => s.table === table);

        it('deletes hardware_assets before hardware_request_items (FK RESTRICT)', () => {
            const plan = buildWipePlan([WipeDomain.HARDWARE]);
            expect(orderOf(plan, 'hardware_assets')).toBeLessThan(
                orderOf(plan, 'hardware_request_items'),
            );
        });

        it('deletes hardware_request_items before hardware_requests', () => {
            const plan = buildWipePlan([WipeDomain.HARDWARE]);
            expect(orderOf(plan, 'hardware_request_items')).toBeLessThan(
                orderOf(plan, 'hardware_requests'),
            );
        });

        it('deletes access_requests and lost_item_reports before tickets (FK without ON DELETE)', () => {
            const plan = buildWipePlan([WipeDomain.TICKETING]);
            expect(orderOf(plan, 'access_requests')).toBeLessThan(orderOf(plan, 'tickets'));
            expect(orderOf(plan, 'lost_item_reports')).toBeLessThan(orderOf(plan, 'tickets'));
        });

        it('deletes ticket_messages and ticket_surveys before tickets (no cascade exists)', () => {
            const plan = buildWipePlan([WipeDomain.TICKETING]);
            expect(orderOf(plan, 'ticket_messages')).toBeLessThan(orderOf(plan, 'tickets'));
            expect(orderOf(plan, 'ticket_surveys')).toBeLessThan(orderOf(plan, 'tickets'));
        });

        it('deletes eform children before eform_requests', () => {
            const plan = buildWipePlan([WipeDomain.EFORM]);
            for (const child of ['eform_credentials', 'eform_signatures', 'eform_approvals']) {
                expect(orderOf(plan, child)).toBeLessThan(orderOf(plan, 'eform_requests'));
            }
        });

        it('deletes installation_schedules before tickets when both domains are selected', () => {
            const plan = buildWipePlan([WipeDomain.TICKETING, WipeDomain.HARDWARE]);
            expect(orderOf(plan, 'installation_schedules')).toBeLessThan(orderOf(plan, 'tickets'));
        });

        it('cleans shared tables before the domain tables they point at', () => {
            const plan = buildWipePlan([WipeDomain.TICKETING]);
            expect(orderOf(plan, 'notifications')).toBeLessThan(orderOf(plan, 'tickets'));
        });
    });

    describe('domain scoping', () => {
        it('touches only e-form tables when only e-form is selected', () => {
            const tables = buildWipePlan([WipeDomain.EFORM]).map((s) => s.table);
            expect(tables).not.toContain('tickets');
            expect(tables).not.toContain('hardware_requests');
            expect(tables).toContain('eform_requests');
        });

        it('does not clean ticket-only shared tables for an e-form-only wipe', () => {
            const tables = buildWipePlan([WipeDomain.EFORM]).map((s) => s.table);
            expect(tables).not.toContain('workflow_executions');
            expect(tables).not.toContain('agent_daily_workload');
        });

        it('filters notifications by the categories of the selected domains', () => {
            const spec = buildWipePlan([WipeDomain.EFORM]).find((s) => s.table === 'notifications');
            expect(spec?.where).toContain('CATEGORY_EFORM');
            expect(spec?.where).not.toContain('CATEGORY_TICKET');
        });

        it('marks tables outside the three named domains so the UI can surface them', () => {
            const plan = buildWipePlan([WipeDomain.TICKETING]);
            const accessRequests = plan.find((s) => s.table === 'access_requests');
            expect(accessRequests?.outOfScope).toBe(true);
            expect(accessRequests?.reason).toBeTruthy();
        });

        it('produces an empty plan when no domain is selected', () => {
            expect(buildWipePlan([])).toEqual([]);
        });
    });
});
