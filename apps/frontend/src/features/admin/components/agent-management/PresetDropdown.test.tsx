import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PresetDropdown } from './PresetDropdown';

describe('PresetDropdown', () => {
    it('renders preset name from applied preset ID when legacy name is missing', () => {
        render(
            <PresetDropdown
                user={{
                    id: 'user-1',
                    fullName: 'Legacy User',
                    email: 'legacy@example.com',
                    role: 'AGENT_OPERATIONAL_SUPPORT',
                    createdAt: '2026-07-21T00:00:00.000Z',
                    appliedPresetId: 'ops-preset',
                    appliedPresetName: null,
                }}
                presets={[{ id: 'ops-preset', name: 'Agent Operational Support' }]}
                onApplyPreset={vi.fn()}
            />,
        );

        expect(screen.getByText('Agent Operational Support')).toBeInTheDocument();
        expect(screen.queryByText('No Preset')).not.toBeInTheDocument();
    });
});
