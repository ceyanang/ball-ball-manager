// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { interceptLinkClick } from '../../src/ui/useUnsavedGuard'

function clickOn(html: string, confirmLeave: () => boolean, init: MouseEventInit = {}) {
  document.body.innerHTML = html
  const target = document.querySelector('[data-t]')!
  const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  Object.defineProperty(e, 'target', { value: target })
  interceptLinkClick(e, confirmLeave)
  return e
}

describe('unsaved-changes link guard', () => {
  it('cancels the navigation when the user says stay', () => {
    const ask = vi.fn(() => false)
    const e = clickOn('<a href="#/office"><span data-t>Office</span></a>', ask)
    expect(ask).toHaveBeenCalledOnce()
    expect(e.defaultPrevented).toBe(true)
  })

  it('lets the navigation through when the user confirms', () => {
    const e = clickOn('<a href="#/office" data-t>Office</a>', () => true)
    expect(e.defaultPrevented).toBe(false)
  })

  it('ignores clicks that are not on links, and modified clicks', () => {
    const ask = vi.fn(() => false)
    clickOn('<button data-t>Save</button>', ask)
    clickOn('<a href="#/office" data-t>Office</a>', ask, { metaKey: true })
    expect(ask).not.toHaveBeenCalled()
  })
})
