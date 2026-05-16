# CRMP Design System

## Description
Design system helpers and token reference for CRMP frontend.

## Triggers
- "Design token"
- "Color scheme"
- "Component style"
- "Theme"
- "CSS variable"

## Color Tokens

### Primary Colors
```css
--primary: #0071e3;           /* Electric Blue */
--primary-foreground: #ffffff;
--primary-hover: #0077ed;
--primary-active: #0068d1;
--primary-glow: rgba(0, 113, 227, 0.15);
```

### Semantic Colors
```css
--success: #34c759;           /* Green */
--warning: #ff9500;           /* Orange */
--destructive: #ff3b30;       /* Red */
--info: #0071e3;              /* Blue */
--accent: #af52de;            /* Purple */
```

### Surfaces
```css
--background: #f5f5f7;        /* Light mode bg */
--foreground: #1d1d1f;        /* Light mode text */
--card: #ffffff;
--muted: #f5f5f7;
--border: rgba(0, 0, 0, 0.08);
```

### Dark Mode
```css
.dark {
  --background: #0a0a0f;
  --foreground: #f5f5f7;
  --card: #1a1a1f;
  --muted: #2a2a2f;
  --border: rgba(255, 255, 255, 0.08);
}
```

## Spacing
```css
--radius: 1rem;               /* 16px default radius */
--radius-sm: 0.5rem;
--radius-md: 0.75rem;
--radius-lg: 1rem;
--radius-xl: 1.25rem;
```

## Shadows
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 12px rgba(0,0,0,0.08);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
--shadow-glow-primary: 0 0 20px rgba(0,113,227,0.25);
```

## Typography
```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
--font-mono: "SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, monospace;
--font-size: 15px;
```

## Component Patterns

### Metric Card
```tsx
<MetricCard
  title="Revenue"
  value="$124K"
  trend="up"
  trendValue="+12%"
  icon={DollarSign}
  tone="primary"
/>
```

### Status Badge
```tsx
<StatusBadge tone="success">Active</StatusBadge>
<StatusBadge tone="warning" dot>Pending</StatusBadge>
```

### Surface Card
```tsx
<SurfaceCard tone="default" padding="md" radius="lg">
  Content here
</SurfaceCard>
```

## Animation Tokens
```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
```
