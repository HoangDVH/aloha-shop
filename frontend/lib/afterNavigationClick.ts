/** Wait until event dispatch finishes; native capture callbacks can flush microtasks early. */
export function afterNavigationClick(event: MouseEvent, navigate: () => void): void {
  setTimeout(() => {
    if (!event.defaultPrevented) navigate();
  }, 0);
}
