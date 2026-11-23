import { useEffect } from 'react'

/**
 * Capture-phase click handler that asks before an in-app link leaves the page. It runs before React Router's Link
 * handler (which skips events that are already defaultPrevented), so cancelling keeps the user where they are.
 * (HashRouter isn't a data router, so react-router's useBlocker isn't available.)
 */
export function interceptLinkClick(e: MouseEvent, confirmLeave: () => boolean): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return
  if (a.href === window.location.href) return
  if (!confirmLeave()) {
    e.preventDefault()
    e.stopPropagation()
  }
}

/** While `dirty`, asks before following an in-app link and before closing or reloading the page. */
export function useUnsavedGuard(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => interceptLinkClick(e, () => window.confirm(message))
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [dirty, message])
}
