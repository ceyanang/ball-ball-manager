import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

/** Bottom sheet on a native <dialog>: focus trap, Esc to close and backdrop tap to close come for free. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sheet-body">
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn sheet-x" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
