# CRMP by EmirCo - Design System

## Overview
This document defines the design system for CRMP by EmirCo, ensuring visual consistency and high-quality UX across the application.

## Design Principles

1. **Clarity First** - Information hierarchy should be immediately obvious
2. **Efficiency** - Reduce clicks and cognitive load for power users
3. **Professional & Modern** - Clean, enterprise-grade aesthetic
4. **Accessibility** - WCAG 2.1 AA compliance minimum
5. **Responsive** - Fully functional from mobile to ultra-wide

---

## Color System

### Brand Colors
```css
--primary: 222 47% 31%;         /* Deep blue - trust & professionalism */
--primary-foreground: 210 40% 98%;
--secondary: 210 40% 96.1%;
--secondary-foreground: 222.2 47.4% 11.2%;
```

### Semantic Colors
```css
--destructive: 0 84.2% 60.2%;   /* Red - errors, deletion */
--success: 142 76% 36%;         /* Green - success states */
--warning: 38 92% 50%;          /* Yellow - warnings */
--info: 199 89% 48%;            /* Blue - info states */
```

### Background & Surface
```css
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--card: 0 0% 100%;
--card-foreground: 222.2 84% 4.9%;
--popover: 0 0% 100%;
--popover-foreground: 222.2 84% 4.9%;
--muted: 210 40% 96.1%;
--muted-foreground: 215.4 16.3% 46.9%;
--accent: 210 40% 96.1%;
--accent-foreground: 222.2 47.4% 11.2%;
--border: 214.3 31.8% 91.4%;
--input: 214.3 31.8% 91.4%;
--ring: 222.2 84% 4.9%;
```

### Dark Mode
All colors have dark mode equivalents defined in `theme.css`.

---

## Typography

### Font Family
- **Primary**: System UI stack (`ui-sans-serif, system-ui, sans-serif`)
- **Monospace**: `ui-monospace, monospace` (for code, timestamps)

### Type Scale
```css
--text-xs: 0.75rem;      /* 12px - Captions, metadata */
--text-sm: 0.875rem;     /* 14px - Secondary text */
--text-base: 1rem;       /* 16px - Body text */
--text-lg: 1.125rem;     /* 18px - Lead paragraphs */
--text-xl: 1.25rem;      /* 20px - Subheadings */
--text-2xl: 1.5rem;      /* 24px - Section headings */
--text-3xl: 1.875rem;    /* 30px - Page titles */
--text-4xl: 2.25rem;     /* 36px - Hero text */
```

### Font Weights
- **400**: Regular (body text)
- **500**: Medium (emphasis, labels)
- **600**: Semibold (subheadings, buttons)
- **700**: Bold (headings, key metrics)

### Line Heights
- **1.25**: Headings (tight)
- **1.5**: Body text (normal)
- **1.75**: Large paragraphs (relaxed)

---

## Spacing System

### Base Unit
```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Component Spacing
- **Card padding**: 24px (space-6)
- **Form field gap**: 16px (space-4)
- **Button padding**: 12px 24px (space-3 x space-6)
- **Section gap**: 32px (space-8)

---

## Component Library

### shadcn/ui Base Components
Located in `/src/app/components/ui/`
- Accordion, Alert, AlertDialog, Avatar, Badge
- Breadcrumb, Button, Calendar, Card, Carousel
- Chart, Checkbox, Collapsible, Command
- ContextMenu, Dialog, Drawer, DropdownMenu
- Form, HoverCard, Input, InputOTP, Label
- Menubar, NavigationMenu, Pagination, Popover
- Progress, RadioGroup, Resizable, ScrollArea
- Select, Separator, Sheet, Sidebar, Skeleton
- Slider, Sonner, Switch, Table, Tabs
- Textarea, Toggle, ToggleGroup, Tooltip

### Custom CRM Components
Located in `/src/app/components/crm-ui/`

#### MetricCard
```tsx
<MetricCard
  title="Total Revenue"
  value="$124,500"
  change={+12.5}
  icon={DollarSign}
  trend="up"
/>
```

#### PageHeader
```tsx
<PageHeader
  title="Clients"
  description="Manage your contacts and accounts"
  actions={[<Button>Add Client</Button>]}
/>
```

#### StatusBadge
```tsx
<StatusBadge status="active" />      // Green
<StatusBadge status="pending" />    // Yellow
<StatusBadge status="inactive" />   // Gray
<StatusBadge status="error" />      // Red
```

---

## Layout Principles

### Container Widths
- **Max width**: 1400px (xl), 1200px (lg), 992px (md)
- **Content padding**: 24px (px-6)

### Grid System
- **Dashboard**: 12-column grid
- **Cards grid**: auto-fit, minmax(280px, 1fr)
- **Form layouts**: 1-2 columns based on complexity

### Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

---

## Animation Guidelines

### Transitions
```css
/* Standard transition */
transition: all 150ms ease-in-out;

/* Slow transitions (modals, drawers) */
transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);

/* Bounce (celebrations) */
transition: all 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Motion Patterns
- **Page transitions**: Fade + slide (200ms)
- **Modal/Dialog**: Scale + fade (300ms)
- **Hover states**: Subtle lift + shadow (150ms)
- **Loading**: Skeleton pulse (2s loop)
- **Success**: Confetti burst (canvas-confetti)

---

## Icon System

### Primary Library: Lucide React
```tsx
import { User, Mail, Phone, Calendar } from 'lucide-react';
```

### Icon Sizes
- **sm**: 16px (inline with text)
- **md**: 20px (buttons, list items)
- **lg**: 24px (standalone icons)
- **xl**: 32px (feature highlights)

### Icon Guidelines
- Use consistent stroke width (2px default)
- Always pair with text labels for accessibility
- Use `aria-label` when standalone

---

## Accessibility Standards

### Requirements
- **Keyboard navigation**: All interactive elements
- **Focus indicators**: Visible focus rings (2px offset)
- **Color contrast**: 4.5:1 minimum for text
- **Screen readers**: Proper ARIA labels
- **Reduced motion**: Respect `prefers-reduced-motion`

### ARIA Patterns
- **Dialogs**: `role="dialog"`, `aria-modal="true"`
- **Navigation**: `role="navigation"`, `aria-label`
- **Tables**: Proper `scope` attributes
- **Forms**: `aria-describedby` for errors

---

## Dark Mode

### Implementation
Uses CSS variables with `dark` class on `<html>` element.

### Key Dark Mode Adjustments
- Background: Deep gray (#0f172a)
- Surfaces: Slightly lighter (#1e293b)
- Text: High contrast whites
- Borders: Subtle grays
- Accents: Maintain brand colors

---

## Best Practices

### Do's
✅ Use design tokens for all values
✅ Maintain consistent spacing
✅ Test at all breakpoints
✅ Use semantic HTML
✅ Add loading states
✅ Provide empty states
✅ Use progressive disclosure

### Don'ts
❌ Hardcode colors or spacing
❌ Use multiple icon libraries (stick to Lucide)
❌ Skip hover/focus states
❌ Use center alignment for long text
❌ Overuse animations
❌ Ignore mobile experience

---

## Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Buttons | ✅ Stable | All variants implemented |
| Forms | ✅ Stable | Validation patterns defined |
| Cards | ✅ Stable | Multiple variants |
| Tables | ✅ Stable | Sortable, paginated |
| Modals | ✅ Stable | Multiple sizes |
| Charts | ✅ Stable | Recharts integration |
| Timeline | ✅ Stable | Custom implementation |
| Pipeline | ✅ Stable | DnD implemented |
| Automation | ✅ Stable | Visual builder |

---

## Resources

- **Tailwind Config**: `/tailwind.config.ts`
- **Theme Variables**: `/src/styles/theme.css`
- **Component Library**: `/src/app/components/`
- **Icon Reference**: https://lucide.dev

---

Last Updated: March 31, 2026
Maintained by: Design Supervisor Agent
