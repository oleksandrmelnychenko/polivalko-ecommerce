export function hasTextSelectionWithin(element: Element): boolean {
  const selection = element.ownerDocument.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false
  for (let index = 0; index < selection.rangeCount; index += 1) {
    if (selection.getRangeAt(index).intersectsNode(element)) return true
  }
  return false
}

export function isInteractiveTarget(target: EventTarget | null, row: Element): boolean {
  let node = target instanceof Element ? target : null
  while (node && node !== row) {
    if (node.matches('a, button, input, select, textarea, label, [role="checkbox"], [data-row-click-ignore]')) return true
    node = node.parentElement
  }
  return false
}
