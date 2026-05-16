# CRMP Component Generator

## Description
Generate new React components following CRMP conventions.

## Triggers
- "Create a new component"
- "Generate component"
- "Add component"
- "New CRM component"

## Conventions

### Component Structure
```tsx
import { useState } from "react";
import { cn } from "../ui/utils";
import { Button } from "../ui/button";

interface MyComponentProps {
  title: string;
  variant?: "default" | "accent";
}

export function MyComponent({ title, variant = "default" }: MyComponentProps) {
  const [active, setActive] = useState(false);
  
  return (
    <div className={cn(
      "rounded-xl border p-4",
      variant === "accent" && "border-primary/20 bg-primary-soft"
    )}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <Button onClick={() => setActive(!active)}>Toggle</Button>
    </div>
  );
}
```

### Rules
1. Use TypeScript strict mode (no `any`)
2. Export named functions (not default)
3. Use `cn()` for conditional classes
4. Import from `../ui/` for base components
5. Use Lucide icons only
6. Props interface above component
7. Keep under 200 lines when possible

### Test Template
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  it('renders with title', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```
