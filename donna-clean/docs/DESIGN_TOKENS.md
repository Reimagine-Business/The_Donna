# The Donna - Design Tokens Reference

Quick reference for developers to avoid hardcoding values.

## Colors

### Primary Colors
- `bg-primary` or `#673AB7` - Main purple (buttons, headers)
- `bg-accent` or `#B39DDB` - Light purple (highlights, focus)
- `border-purple-500` - Purple borders

### Backgrounds
- `bg-background` or `#0f0f1e` - Main page background
- `bg-card` - Card backgrounds (purple tint)
- `bg-secondary` or `#16213e` - Sidebar, modals

### Text
- `text-foreground` - Primary text (white)
- `text-muted-foreground` - Secondary text (50% white)
- `text-accent` - Purple accent text

### Financial Colors (ONLY for numbers)
- `text-positive` or `text-green-400` - Profit, income (+)
- `text-destructive` or `text-red-400` - Loss, expense (-)

### Entry Types
- Cash IN: `text-green-400` / `border-green-500`
- Cash OUT: `text-red-400` / `border-red-500`
- Credit: `text-purple-400` / `border-purple-500`
- Advance: `text-purple-400` / `border-purple-500`

## Spacing (Tailwind)

- `p-2` = 8px padding
- `p-4` = 16px padding
- `p-6` = 24px padding
- `m-2` = 8px margin
- `m-4` = 16px margin
- `gap-4` = 16px gap

## Component Patterns

### Purple Card
```tsx
<div className="bg-card border border-purple-500/30 rounded-lg p-4">
  Content here
</div>
```

### Gradient Background
```tsx
<div className="bg-gradient-to-br from-[#0f0f23] to-[#1a1a2e]">
  Content here
</div>
```

### Financial Number
```tsx
<span className="text-green-400">+5,000</span>  // Positive
<span className="text-red-400">-3,000</span>    // Negative
```

## Do NOT Hardcode

Bad:
- `<div style={{ backgroundColor: '#673AB7' }}>`
- `<div className="bg-[#673AB7]">`
- `<div style={{ padding: '16px' }}>`

Good:
- `<div className="bg-primary">`
- `<div className="bg-primary p-4">`
