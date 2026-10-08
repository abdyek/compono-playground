import { ref, watch } from 'vue'

// Per-browser preferences. They aren't part of the input or share links.

const PREVIEW_DARK_KEY = 'compono-playground:preview-dark'

function readPreviewDark(): boolean {
  try {
    const stored = localStorage.getItem(PREVIEW_DARK_KEY)
    if (stored !== null) {
      return stored === 'true'
    }
  } catch {
    // Storage may be unavailable; fall back to the system theme.
  }
  return matchMedia('(prefers-color-scheme: dark)').matches
}

/** Renders the preview with the browser's dark defaults. */
export const previewDark = ref(readPreviewDark())

watch(previewDark, (dark) => {
  try {
    localStorage.setItem(PREVIEW_DARK_KEY, String(dark))
  } catch {
    // The preference is kept for this visit only.
  }
})
