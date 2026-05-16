# CRMP Testing

## Description
Testing helpers and conventions for CRMP frontend.

## Triggers
- "Write test"
- "Test component"
- "Add test"
- "Testing"

## Test Setup

Tests use Vitest + React Testing Library + happy-dom.

### Basic Test Structure
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles interaction', async () => {
    const { user } = render(<MyComponent />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
```

### Mocking
```tsx
import { vi } from 'vitest';

// Mock API call
vi.mock('../../lib/crm-api', () => ({
  fetchDeals: vi.fn().mockResolvedValue({ deals: [] }),
}));

// Mock hook
vi.mock('../../providers/CrmProvider', () => ({
  useCrmApp: () => ({ authState: 'authenticated' }),
}));
```

### Testing Hooks
```tsx
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  it('debounces value', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );
    
    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');
    
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe('updated');
  });
});
```

### Test Locations
- Components: `src/test/components/*.test.tsx`
- Hooks: `src/test/hooks/*.test.ts`
- Pages: `src/test/pages/*.test.tsx`

### Running Tests
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

### Coverage Goals
- Components: 80%+
- Hooks: 90%+
- Utilities: 90%+
