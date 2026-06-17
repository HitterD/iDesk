import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BentoLoginPage } from '../BentoLoginPage';

describe('BentoLoginPage smoke', () => {
  it('renders the sign-in form fields and submit button', () => {
    render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText(/user@company\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/•+/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue|sign in|authenticate/i })).toBeInTheDocument();
  });
});
