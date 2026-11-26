import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FACE_VARIANTS } from '../../src/engine/face/face'
import { eyeColorWeights, eyeWeights, facialHairWeights, hairColorWeights, hairWeights, skinWeights } from '../../src/engine/face/tables'
import { HERITAGES } from '../../src/engine/face/heritage'
import { Accessory, Brows, Ears, Eyes, FacialHair, Hair, Mouth, Nose } from '../../src/ui/face/parts'

const render = (el: React.ReactElement) => renderToStaticMarkup(createElement('svg', null, el))
const team = { primary: '#123456', secondary: '#abcdef' }

describe('every face part renders', () => {
  it('all variants of every part draw (index 0 may be empty only for hair/facial hair/accessory)', () => {
    for (let v = 0; v < FACE_VARIANTS.ears; v++) expect(render(createElement(Ears, { v, skin: '#eebf98' }))).toContain('ellipse')
    for (let v = 0; v < FACE_VARIANTS.eyes; v++) expect(render(createElement(Eyes, { v, color: '#4a2c17' }))).toMatch(/<(path|ellipse|circle)/)
    for (let v = 0; v < FACE_VARIANTS.brows; v++) expect(render(createElement(Brows, { v, color: '#222' }))).toContain('path')
    for (let v = 0; v < FACE_VARIANTS.nose; v++) expect(render(createElement(Nose, { v, skin: '#eebf98' }))).toMatch(/<(path|ellipse|g)/)
    for (let v = 0; v < FACE_VARIANTS.mouth; v++) expect(render(createElement(Mouth, { v }))).toMatch(/<(path|ellipse|g)/)
    for (let v = 1; v < FACE_VARIANTS.hair; v++) {
      for (const recede of [0, 0.5, 1]) expect(render(createElement(Hair, { v, color: '#222', recede }))).toContain('path')
    }
    for (let v = 1; v < FACE_VARIANTS.facialHair; v++) expect(render(createElement(FacialHair, { v, color: '#222' }))).toMatch(/<(path|g)/)
    for (let v = 1; v < FACE_VARIANTS.accessory; v++) expect(render(createElement(Accessory, { v, team }))).toMatch(/<(path|rect|circle|g)/)
  })
})

describe('tables only reference real variants', () => {
  it('indices are in range and every bucket has hair variety', () => {
    const check = (k: keyof typeof FACE_VARIANTS, t: { map: Record<number, number> }) => {
      for (const i of Object.keys(t.map)) expect(Number(i)).toBeLessThan(FACE_VARIANTS[k])
    }
    for (const h of HERITAGES) for (const skin of [0, 4, 8, 11]) {
      check('skin', skinWeights(h)); check('eyes', eyeWeights(h)); check('facialHair', facialHairWeights(h))
      check('hair', hairWeights(h, skin)); check('hairColor', hairColorWeights(h, skin)); check('eyeColor', eyeColorWeights(h, skin))
      expect(Object.values(hairWeights(h, skin).map).filter((x) => x > 0).length).toBeGreaterThanOrEqual(6)
    }
  })
  it('new art exists and each bucket weights some of it', () => {
    expect(FACE_VARIANTS.hair).toBeGreaterThanOrEqual(36)
    expect(FACE_VARIANTS.eyes).toBeGreaterThanOrEqual(10)
    for (const h of ['asian', 'african', 'latino', 'european'] as const) {
      const newHair = Object.entries(hairWeights(h, 8).map).filter(([i, x]) => Number(i) >= 22 && x > 0)
      expect(newHair.length).toBeGreaterThanOrEqual(2)
    }
  })
})
