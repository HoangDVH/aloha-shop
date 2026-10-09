/** Space below the trigger, leaving room for the dropdown gap and bottom edge. */
export function megaMenuAvailableHeight(viewportBottom: number, triggerBottom: number): number {
  return Math.max(0, Math.floor(viewportBottom - triggerBottom - 18));
}
