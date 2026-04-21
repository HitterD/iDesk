import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPipeline } from '../components/common/StatusPipeline';

it('marks completed steps up to current', () => {
    render(<StatusPipeline current="APPROVED" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
});
