import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { rivalLabel } from '../../src/ui/rivals'

describe('rivalLabel', () => {
  const l = createLeague({ seed: 2, userTeamIndex: 0, name: 'U' })
  it('tells starting, dynamic and non-rivals apart', () => {
    expect(rivalLabel(l, 't_cle', 't_gsw')).toBe('starting')
    l.rivalry.dynamic.t_cle = ['t_atl']
    expect(rivalLabel(l, 't_cle', 't_atl')).toBe('dynamic')
    expect(rivalLabel(l, 't_cle', 't_sac')).toBeNull()
  })
  it('sees a rival listed only by the other side', () => {
    l.rivalry.dynamic.t_den = ['t_sac']
    expect(rivalLabel(l, 't_sac', 't_den')).toBe('dynamic')
  })
})
