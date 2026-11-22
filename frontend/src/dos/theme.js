// ============================================================================
// PANTA — centralized theme configuration (all consoles).
// Single source of truth for colors used in JS (charts, dynamic styles).
// The same tokens are exposed as CSS variables in theme.css.
// ============================================================================

export const theme = {
  colors: {
    navy: '#12304A',
    deepNavy: '#0B2235',
    sidebar: '#102B42',
    sidebarText: '#C2D3DF',
    blue: '#0F9D8A',
    blueHover: '#0B7F70',
    brightBlue: '#20B8A2',
    lightBlue: '#E7F5F2',
    teal: '#0F9D8A',
    tealDark: '#0B7F70',
    bg: '#F4F7FB',
    card: '#FFFFFF',
    border: '#D8E5EC',
    text: '#1D2B3A',
    muted: '#64748B',
    faint: '#829AB1',
    // supporting
    success: '#18B981',
    successLight: '#E8F8F2',
    warning: '#F59E0B',
    warningLight: '#FFF7E6',
    danger: '#EF4444',
    dangerLight: '#FEECEC',
    purple: '#6D5CE7',
    purpleLight: '#F0EEFF',
    // stat card accents
    accentGreen: '#18B981',
    accentBlue: '#0F9D8A',
    accentPurple: '#6D5CE7',
    accentAmber: '#F59E0B',
    // status badges
    pending: '#F59E0B',
    completed: '#18B981',
    inProgress: '#0F9D8A'
  },
  // Pastel timetable chips (light bg + darker text), rotated by subject hash
  chips: [
    { bg: '#E8F8F2', text: '#0E9F70' },
    { bg: '#E7F5F2', text: '#0B7F70' },
    { bg: '#FFF7E6', text: '#B45309' },
    { bg: '#F0EEFF', text: '#6D5CE7' },
    { bg: '#FEECEC', text: '#B91C1C' },
    { bg: '#E0F2FE', text: '#0369A1' },
    { bg: '#FCE7F3', text: '#BE185D' },
    { bg: '#ECFCCB', text: '#4D7C0F' }
  ],
  // Chart / performance bar colors
  perf: ['#0F9D8A', '#18B981', '#F59E0B', '#6D5CE7', '#EF4444', '#20B8A2'],
  radius: '16px',
  sidebarWidth: '248px',
  headerHeight: '64px'
}

export const chipFor = (name = '') =>
  theme.chips[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % theme.chips.length]
