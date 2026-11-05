import { Alert, Autocomplete, Badge, Combobox, createTheme, Drawer, Modal, MultiSelect, Select, Tooltip, parseThemeColor, type MantineColorsTuple } from '@mantine/core'
import './chip-palette.css'
import './alerts.css'
import './table-chips.css'
import './comboboxes.css'
import './segmented-controls.css'

const brand: MantineColorsTuple = [
  '#e6f6ec',
  '#c8ebd5',
  '#9fdcb6',
  '#72cc94',
  '#46bc73',
  '#1fae5b',
  '#00a046',
  '#008a3c',
  '#006f30',
  '#005524',
]

const fontFamily = 'Onest, system-ui, -apple-system, "Segoe UI", sans-serif'

const comboboxStyles = {
  dropdown: { minWidth: 'max(220px, var(--popover-anchor-width, 0px))' },
}

const chipTones: Record<string, string> = {
  gray: 'neutral',
  dark: 'neutral',
  blue: 'document',
  cyan: 'source',
  teal: 'storage',
  green: 'success',
  brand: 'success',
  yellow: 'warning',
  orange: 'warning',
  red: 'danger',
  violet: 'product',
}

export const theme = createTheme({
  fontFamily,
  headings: { fontFamily, fontWeight: '600' },
  black: '#1a1a1a',
  colors: { brand },
  primaryColor: 'brand',
  primaryShade: 6,
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Combobox: Combobox.extend({
      defaultProps: { position: 'bottom-start' },
      styles: comboboxStyles,
    }),
    Select: Select.extend({ styles: comboboxStyles }),
    MultiSelect: MultiSelect.extend({ styles: comboboxStyles }),
    Autocomplete: Autocomplete.extend({ styles: comboboxStyles }),
    Badge: Badge.extend({
      styles: (current, props) => {
        const color = parseThemeColor({ color: props.color ?? 'gray', theme: current })
        const palette = color.isThemeColor ? current.colors[color.color] : undefined
        const tone = color.isThemeColor ? chipTones[color.color] : undefined
        return {
          root: {
            '--table-chip-bg': tone ? `var(--app-chip-${tone}-bg)` : palette?.[0] ?? `color-mix(in srgb, ${color.value} 8%, white)`,
            '--table-chip-border': tone ? `var(--app-chip-${tone}-border)` : palette?.[3] ?? `color-mix(in srgb, ${color.value} 30%, white)`,
            '--table-chip-text': tone ? `var(--app-chip-${tone}-text)` : palette?.[9] ?? `color-mix(in srgb, ${color.value} 65%, black)`,
          },
        }
      },
    }),
    Alert: Alert.extend({ classNames: { root: 'app-alert' } }),
    Modal: Modal.extend({
      defaultProps: {
        overlayProps: { backgroundOpacity: 0.25, blur: 2 },
        transitionProps: { transition: 'pop', duration: 220, timingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: { overlayProps: { backgroundOpacity: 0.25, blur: 2 } },
    }),
    Tooltip: Tooltip.extend({
      defaultProps: { openDelay: 250 },
      styles: {
        tooltip: { backgroundColor: '#1a1a1a', color: '#ffffff', fontSize: 12 },
      },
    }),
  },
})
