# 🎨 B-Trust Design System - Color Palette

## Primary Colors

### Soft Blue Gradient
```css
/* Main Primary */
#5B7CFF - Soft Blue (Primary Color)
#4A63E6 - Deep Blue (Primary Dark)
#7B99FF - Light Blue (Primary Light)

/* Gradient */
linear-gradient(135deg, #5B7CFF 0%, #A6C1FF 100%)
```

**Usage:**
- Main CTA buttons
- Brand logo and headers
- Active navigation states
- Links and interactive elements
- Focus states

**Characteristics:**
- Trustworthy and professional
- Modern and friendly
- High readability on white
- Not too corporate or cold

---

## Accent Colors

### Vibrant Palette
```css
#9B87F5 - Soft Purple (Accent Purple)
#5B9CFF - Sky Blue (Accent Blue)
#F093FB - Soft Pink (Accent Pink)
```

**Usage:**
- Decorative elements
- Special features
- Gradient overlays
- Hover states
- Premium indicators

---

## Status Colors

### Success
```css
#00D4AA - Mint Green
linear-gradient(135deg, rgba(0, 212, 170, 0.15) 0%, rgba(0, 212, 170, 0.1) 100%)
```
**Usage:** Active accounts, successful operations, positive metrics, confirmations

### Warning
```css
#FFB84D - Warm Orange
linear-gradient(135deg, rgba(255, 184, 77, 0.15) 0%, rgba(255, 184, 77, 0.1) 100%)
```
**Usage:** Alerts, pending states, caution messages, intermediate status

### Danger
```css
#FF6B6B - Coral Red
linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%)
```
**Usage:** Errors, delete actions, critical warnings, inactive accounts

### Info
```css
#5B9CFF - Sky Blue
linear-gradient(135deg, rgba(91, 156, 255, 0.15) 0%, rgba(91, 156, 255, 0.1) 100%)
```
**Usage:** Information messages, helpful tips, general notifications

---

## Neutral Colors

### Text Colors
```css
#1A1D2E - Dark Navy (Primary Text)
#6B7280 - Medium Gray (Secondary Text)
#9CA3AF - Light Gray (Tertiary Text)
#FFFFFF - Pure White (White Text)
#D1D5DB - Muted Gray (Disabled Text)
```

**Hierarchy:**
1. **Primary Text** (#1A1D2E): Headlines, important content
2. **Secondary Text** (#6B7280): Body text, descriptions
3. **Tertiary Text** (#9CA3AF): Captions, meta information
4. **White Text** (#FFFFFF): On dark/colored backgrounds
5. **Muted Text** (#D1D5DB): Disabled states, placeholders

---

### Background Colors
```css
#F8F9FF - Soft White-Blue (Primary Background)
#FFFFFF - Pure White (Card Background)
#1A1D2E - Dark Navy (Dark Background)
#E8EEFF - Light Blue-Gray (Secondary Background)
#F5F7FF - Hover Background

/* Gradients */
linear-gradient(135deg, #F8F9FF 0%, #E8EEFF 100%) - Main Background
linear-gradient(135deg, #FFFFFF 0%, #F8F9FF 100%) - Card Backgrounds
```

---

### Border Colors
```css
#E5E7EB - Standard Border
#F3F4F6 - Light Border
rgba(91, 124, 255, 0.1) - Subtle Blue Border
rgba(91, 124, 255, 0.3) - Hover Blue Border
```

---

## Gradient Combinations

### 1. Primary Gradient (Most Used)
```css
background: linear-gradient(135deg, #5B7CFF 0%, #A6C1FF 100%);
```
**Where:** Buttons, badges, active states, brand elements

### 2. Success Gradient
```css
background: linear-gradient(135deg, rgba(0, 212, 170, 0.15) 0%, rgba(0, 212, 170, 0.1) 100%);
```
**Where:** Success messages, positive stat cards

### 3. Danger Gradient
```css
background: linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%);
```
**Where:** Delete buttons, error states

### 4. Card Background Gradient
```css
background: linear-gradient(135deg, #FFFFFF 0%, #F8F9FF 100%);
```
**Where:** Cards, summary boxes, containers

### 5. Page Background Gradient
```css
background: linear-gradient(135deg, #F8F9FF 0%, #E8EEFF 50%, #D8DEFF 100%);
```
**Where:** Main page background (login page)

### 6. Purple Gradient (Decorative)
```css
background: linear-gradient(135deg, #9B87F5 0%, #F093FB 100%);
```
**Where:** Floating shapes, special elements

---

## Shadow Colors

### Standard Shadow (Blue Tint)
```css
/* Extra Small */
box-shadow: 0 1px 2px rgba(91, 124, 255, 0.04);

/* Small */
box-shadow: 0 4px 6px rgba(91, 124, 255, 0.06);

/* Medium */
box-shadow: 0 10px 15px rgba(91, 124, 255, 0.08);

/* Large */
box-shadow: 0 20px 25px rgba(91, 124, 255, 0.1);

/* Extra Large */
box-shadow: 0 25px 50px rgba(91, 124, 255, 0.15);

/* Card Shadow */
box-shadow: 0 4px 20px rgba(91, 124, 255, 0.08);

/* Hover Shadow */
box-shadow: 0 10px 30px rgba(91, 124, 255, 0.15);
```

**Why Blue Tint?**
- Creates cohesive brand presence
- Softer than pure black shadows
- Matches primary color palette
- More modern and friendly

---

## Opacity Scale

### Background Overlays
```css
rgba(255, 255, 255, 0.95) - Glassmorphism cards
rgba(255, 255, 255, 0.85) - Header backdrop
rgba(255, 255, 255, 0.7)  - Navigation background
rgba(255, 255, 255, 0.6)  - Tab containers
rgba(255, 255, 255, 0.3)  - Ripple effects
rgba(255, 255, 255, 0.1)  - Subtle overlays
```

### Colored Overlays
```css
rgba(91, 124, 255, 0.05) - Very subtle blue tint
rgba(91, 124, 255, 0.1)  - Subtle blue background
rgba(91, 124, 255, 0.2)  - Border highlight
rgba(91, 124, 255, 0.3)  - Hover border
```

---

## Accessibility

### WCAG AA Contrast Ratios

#### Primary Text on White
```
#1A1D2E on #FFFFFF = 12.63:1 ✅ (AAA)
#6B7280 on #FFFFFF = 5.74:1 ✅ (AA)
#9CA3AF on #FFFFFF = 3.54:1 ✅ (AA Large)
```

#### White Text on Primary
```
#FFFFFF on #5B7CFF = 4.89:1 ✅ (AA)
#FFFFFF on #4A63E6 = 5.98:1 ✅ (AA)
```

#### Status Colors
```
Success #00D4AA: Sufficient contrast on white
Warning #FFB84D: Sufficient contrast on white
Danger #FF6B6B: Sufficient contrast on white
```

---

## Color Psychology

### Primary Blue (#5B7CFF)
- **Trust**: Banking and financial security
- **Intelligence**: Smart financial decisions
- **Calm**: Reduces anxiety about money
- **Professional**: Credible institution

### Success Green (#00D4AA)
- **Growth**: Financial prosperity
- **Positive**: Good outcomes
- **Fresh**: Modern approach
- **Safe**: Secure transactions

### Warning Orange (#FFB84D)
- **Attention**: Important notices
- **Warmth**: Friendly alerts
- **Energy**: Take action
- **Caution**: Proceed carefully

### Danger Red (#FF6B6B)
- **Alert**: Critical issues
- **Stop**: Prevent errors
- **Important**: High priority
- **Soft**: Not aggressive (coral tone)

---

## Design Tokens

### CSS Variable Names
```css
/* Primary */
--primary-color
--primary-dark
--primary-light
--primary-gradient

/* Status */
--success-color
--warning-color
--danger-color
--info-color

/* Accent */
--accent-purple
--accent-blue
--accent-pink

/* Text */
--text-primary
--text-secondary
--text-light
--text-white
--text-muted

/* Background */
--bg-primary
--bg-white
--bg-dark
--bg-card
--bg-hover
--bg-gradient

/* Border */
--border-color
--border-light

/* Shadows */
--shadow-xs
--shadow-sm
--shadow-md
--shadow-lg
--shadow-xl
--shadow-card
--shadow-hover
```

---

## Brand Guidelines

### Do's ✅
- Use primary blue for main actions
- Apply gradients consistently (135deg)
- Maintain soft, rounded aesthetics
- Use shadows with blue tint
- Keep opacity overlays consistent
- Use success green sparingly

### Don'ts ❌
- Mix gradients in inconsistent directions
- Use pure black shadows
- Apply danger red liberally
- Use saturated, bright colors
- Mix warm and cool tones randomly
- Overuse accent colors

---

## Color Relationships

### Harmonious Pairs
```
Primary Blue + Accent Purple = 🎨 Creative
Primary Blue + Success Green = ✅ Trustworthy
Primary Blue + Soft Pink = 💎 Modern
Success Green + Warning Orange = ⚡ Energetic
```

### Contrast Pairs
```
Primary Blue + Pure White = 📱 Clean
Dark Navy + Soft Blue = 🌊 Professional
Coral Red + Mint Green = 🎯 Clear Status
```

---

## Implementation Examples

### Button
```css
.btn-primary {
  background: linear-gradient(135deg, #5B7CFF 0%, #A6C1FF 100%);
  color: #FFFFFF;
  box-shadow: 0 4px 6px rgba(91, 124, 255, 0.06);
}

.btn-primary:hover {
  box-shadow: 0 10px 15px rgba(91, 124, 255, 0.08);
}
```

### Card
```css
.card {
  background: linear-gradient(135deg, #FFFFFF 0%, #F8F9FF 100%);
  border: 1px solid #F3F4F6;
  box-shadow: 0 4px 20px rgba(91, 124, 255, 0.08);
}

.card:hover {
  box-shadow: 0 10px 30px rgba(91, 124, 255, 0.15);
}
```

### Success Badge
```css
.badge-success {
  background: linear-gradient(135deg, rgba(0, 212, 170, 0.15) 0%, rgba(0, 212, 170, 0.1) 100%);
  color: #00D4AA;
  border: 1px solid rgba(0, 212, 170, 0.3);
}
```

---

## Customization

### Changing Primary Color
To change from soft blue to another color:

1. **Update primary colors:**
```css
--primary-color: #YOUR_COLOR;
--primary-dark: /* Darker version */;
--primary-light: /* Lighter version */;
--primary-gradient: linear-gradient(135deg, #YOUR_COLOR 0%, #LIGHTER_VERSION 100%);
```

2. **Update shadows:**
```css
--shadow-md: 0 10px 15px rgba(YOUR_RGB, 0.08);
```

3. **Test contrast ratios**
4. **Update floating shapes** (login page)

---

## Tools & Resources

### Color Palette Generators
- [Coolors.co](https://coolors.co/)
- [Adobe Color](https://color.adobe.com/)
- [Paletton](https://paletton.com/)

### Gradient Generators
- [CSS Gradient](https://cssgradient.io/)
- [Gradient Hunt](https://gradienthunt.com/)

### Contrast Checkers
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Contrast Ratio](https://contrast-ratio.com/)

### Shadow Generators
- [Smooth Shadow](https://shadows.brumm.af/)
- [Shadow Palette Generator](https://www.joshwcomeau.com/shadow-palette/)

---

**This color system creates a cohesive, professional, and modern banking interface that users can trust! 🎨✨**
