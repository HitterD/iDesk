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
    expect(screen.getByPlaceholderText(/nik atau email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/•+/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue|sign in|authenticate/i })).toBeInTheDocument();
  });

  it('renders only the first two background slides, as compressed WebP', () => {
    const { container } = render(
      <MemoryRouter>
        <BentoLoginPage />
      </MemoryRouter>
    );
    const slides = Array.from(container.querySelectorAll<HTMLImageElement>('img[src^="/login-plants/"]'));
    expect(slides.map((img) => img.getAttribute('src'))).toEqual([
      '/login-plants/sidoarjo-plant.webp',
      '/login-plants/sukodono-plant.webp',
    ]);
  });
});
