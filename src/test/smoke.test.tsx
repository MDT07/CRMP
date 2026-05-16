import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('CRMP Test Suite', () => {
  it('should have testing environment configured', () => {
    expect(true).toBe(true);
  });

  it('should render basic HTML', () => {
    render(<div>CRMP by EmirCo</div>);
    expect(screen.getByText('CRMP by EmirCo')).toBeInTheDocument();
  });
});
