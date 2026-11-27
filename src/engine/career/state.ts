import type { League } from '../types'
import type { CareerBuild, CareerState } from './types'

export const emptyCareer = (playerId: string, build: CareerBuild): CareerState => ({
  playerId, status: 'building', build, draftTags: [], draftAnswers: [], played: 0, simmed: 0,
  growth: [], log: [], pending: null, ending: null,
})
export const isCareer = (l: League): boolean => l.career != null
