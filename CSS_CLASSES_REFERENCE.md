# Sidebar Dashboard CSS Classes Reference

## Layout Classes

### `.dashboard-layout`
Main container for the entire dashboard
- `display: flex`
- `min-height: 100vh`
- `background: var(--bg-primary)`

---

## Sidebar Classes

### `.dashboard-sidebar`
The collapsible sidebar container
- **Width Expanded**: `256px`
- **Width Collapsed**: `64px` (via `.collapsed` modifier)
- **Position**: `fixed` (left: 0, top: 0, bottom: 0)
- **Background**: `linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)`
- **Transition**: `width 0.3s ease`
- **Z-index**: `1000`

### `.dashboard-sidebar.collapsed`
Modifier class when sidebar is collapsed
- Changes width to `64px`
- Hides all `.menu-label` elements
- Centers navigation buttons

---

## Sidebar Header

### `.sidebar-header`
Top section with logo and title
- `padding: var(--spacing-lg) var(--spacing-md)`
- `min-height: 80px`
- `border-bottom: 1px solid rgba(255, 255, 255, 0.1)`

### `.sidebar-logo`
Bank logo image
- `width: 40px`
- `height: 40px`
- `flex-shrink: 0`

### `.sidebar-header h2`
Bank name title
- `font-size: var(--font-size-lg)`
- `font-weight: var(--font-weight-bold)`
- Fades out when sidebar collapsed

---

## Sidebar Navigation

### `.sidebar-nav`
Navigation container
- `padding: var(--spacing-sm) 0`

### `.sidebar-nav ul`
Navigation list
- `list-style: none`
- `padding: 0`
- `margin: 0`

### `.sidebar-nav button`
Navigation menu button
- **Default State**:
  - `color: rgba(255, 255, 255, 0.8)`
  - `background: transparent`
- **Hover State**:
  - `background: rgba(255, 255, 255, 0.1)`
  - `color: white`
- **Active State** (`.active`):
  - `background: white`
  - `color: #1e3a8a`
  - `font-weight: var(--font-weight-semibold)`
  - `::before` - 4px left border in blue

### `.menu-icon`
Icon container in menu button
- `width: 20px`
- `height: 20px`
- `flex-shrink: 0`

### `.menu-label`
Text label in menu button
- `white-space: nowrap`
- Fades to `opacity: 0` when sidebar collapsed

---

## Sidebar Footer

### `.sidebar-footer`
Bottom section with user info and logout
- `padding: var(--spacing-md)`
- `border-top: 1px solid rgba(255, 255, 255, 0.1)`
- `margin-top: auto` (pushes to bottom)

### `.sidebar-user-info`
User information display
- `display: flex`
- `gap: var(--spacing-md)`
- `color: rgba(255, 255, 255, 0.9)`

### `.user-details`
Container for user name and role
- `display: flex`
- `flex-direction: column`
- Hides when sidebar collapsed

### `.user-name`
User's full name
- `font-size: var(--font-size-sm)`
- `font-weight: var(--font-weight-semibold)`

### `.user-role`
User's role (Agent/Admin/Manager)
- `font-size: var(--font-size-xs)`
- `color: rgba(255, 255, 255, 0.7)`

### `.sidebar-logout-btn`
Logout button
- `background: rgba(220, 38, 38, 0.8)`
- **Hover**: `rgba(220, 38, 38, 1)`
- `border-radius: var(--border-radius)`
- Text hides when sidebar collapsed

---

## Main Content Area

### `.dashboard-main`
Main content container
- `flex: 1`
- `margin-left: 256px` (or `64px` when sidebar collapsed)
- `transition: margin-left 0.3s ease`
- `min-height: 100vh`

### `.dashboard-content-wrapper`
Wrapper for content header and body
- `flex: 1`
- `display: flex`
- `flex-direction: column`

### `.content-header`
Top header showing current section
- `background: white`
- `padding: var(--spacing-lg) var(--spacing-xl)`
- `border-bottom: 1px solid var(--border-color)`
- `box-shadow: var(--shadow-sm)`

### `.content-header h1`
Section title
- `font-size: var(--font-size-xxl)`
- `font-weight: var(--font-weight-bold)`
- `color: var(--primary-color)`
- `margin: 0`

### `.content-body`
Main content area
- `flex: 1`
- `padding: var(--spacing-xl)`
- `background: var(--bg-primary)`

---

## Utility Classes

### `.sidebar-toggle`
Toggle button for collapsing sidebar
- `background: rgba(255, 255, 255, 0.1)`
- **Hover**: `rgba(255, 255, 255, 0.2)`
- `padding: var(--spacing-sm)`
- `border-radius: var(--border-radius)`

### `.sidebar-content`
Scrollable navigation area
- `flex: 1`
- `overflow-y: auto`
- `overflow-x: hidden`

### `.no-dashboard-message`
Error message for invalid roles
- `display: flex`
- `align-items: center`
- `justify-content: center`
- `padding: var(--spacing-xxl)`
- `background: white`
- `border-radius: var(--border-radius-lg)`

---

## Responsive Classes

### Desktop (> 1024px)
- Sidebar: `256px` (expandable)
- Full labels visible
- All features enabled

### Tablet (≤ 1024px)
- Sidebar: `64px` (always collapsed)
- Labels hidden
- Icons only
- `margin-left` adjusted

### Mobile (≤ 768px)
- Sidebar: `64px`
- Reduced padding
- Smaller font sizes
- Content header: `var(--font-size-xl)`

### Extra Small (≤ 480px)
- Sidebar: `56px`
- Minimal padding
- Content header: `var(--font-size-lg)`

---

## State Classes

### `.collapsed`
Applied to `.dashboard-sidebar`
- Reduces width to `64px`
- Hides text labels
- Centers icons
- Removes text from logout button

### `.active`
Applied to navigation buttons
- White background
- Blue text color
- Bold font weight
- Left border indicator

---

## CSS Variables Used

```css
/* Spacing */
--spacing-xs: 0.2rem
--spacing-sm: 0.4rem
--spacing-md: 0.75rem
--spacing-lg: 1.1rem
--spacing-xl: 1.5rem
--spacing-xxl: 2.25rem

/* Colors */
--primary-color: #1a365d
--bg-primary: #f8f9fa
--border-color: #dee2e6
--text-primary: #212529
--text-secondary: #123c62

/* Typography */
--font-size-xs: 0.68rem
--font-size-sm: 0.8rem
--font-size-md: 0.92rem
--font-size-lg: 1.05rem
--font-size-xl: 1.15rem
--font-size-xxl: 1.35rem

/* Weights */
--font-weight-regular: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700

/* Effects */
--border-radius: 6px
--border-radius-lg: 8px
--shadow-sm: 0 1px 2px rgba(0,0,0,0.08)
--shadow-md: 0 2px 6px rgba(0,0,0,0.1)
```

---

## Animation/Transition Classes

All transitions use `ease` timing function:
- Sidebar width: `0.3s`
- Button hovers: `0.2s`
- Text opacity: `0.2s`
- Margin adjustments: `0.3s`

---

## Example HTML Structure

```html
<div class="dashboard-layout">
  <aside class="dashboard-sidebar"><!-- or .collapsed -->
    <div class="sidebar-header">
      <img src="logo.png" class="sidebar-logo" alt="Logo" />
      <h2>B-Trust Bank</h2>
    </div>
    
    <button class="sidebar-toggle">
      <!-- Toggle icon -->
    </button>
    
    <div class="sidebar-content">
      <nav class="sidebar-nav">
        <ul>
          <li>
            <button class="active"><!-- or no class -->
              <span class="menu-icon"><!-- SVG --></span>
              <span class="menu-label">Menu Item</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
    
    <div class="sidebar-footer">
      <div class="sidebar-user-info">
        <!-- User icon -->
        <div class="user-details">
          <span class="user-name">John Doe</span>
          <span class="user-role">Agent</span>
        </div>
      </div>
      <button class="sidebar-logout-btn">
        <!-- Logout icon -->
        <span>Logout</span>
      </button>
    </div>
  </aside>
  
  <main class="dashboard-main">
    <div class="dashboard-content-wrapper">
      <header class="content-header">
        <h1>Section Title</h1>
      </header>
      <div class="content-body">
        <!-- Component content -->
      </div>
    </div>
    <footer><!-- Footer --></footer>
  </main>
</div>
```

---

## Customization Tips

### Change Sidebar Colors:
```css
.dashboard-sidebar {
  background: linear-gradient(180deg, #your-color-1, #your-color-2);
}
```

### Adjust Collapsed Width:
```css
.dashboard-sidebar.collapsed {
  width: 80px; /* Change from 64px */
}
```

### Modify Active State:
```css
.sidebar-nav button.active {
  background: #your-color;
  color: #your-text-color;
}

.sidebar-nav button.active::before {
  background: #your-border-color;
}
```

### Change Transitions:
```css
.dashboard-sidebar {
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); /* Custom easing */
}
```

---

**Pro Tips**:
1. Use browser DevTools to inspect element states
2. Test all breakpoints using responsive mode
3. Check collapsed and expanded states thoroughly
4. Verify hover effects on all interactive elements
5. Ensure sufficient color contrast for accessibility
