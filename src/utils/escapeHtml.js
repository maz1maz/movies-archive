// Film fields (title, director, studio, borrowedTo, ...) are user-editable
// and get interpolated into raw HTML strings for the Print/PDF export views
// (printWindow.document.write). Escape them first so a field can't inject
// markup/script into that print window.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
}
