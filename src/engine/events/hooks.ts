import type { Game, League } from '../types'
import { rollEvent } from './engine'

/** Entry points the season engine calls (only when the sim was asked to pause for events). */
const isUserGame = (l: League, g: Game) => g.homeId === l.userTeamId || g.awayId === l.userTeamId

/** Before the user's game is played. */
export const beforeUserGame = (l: League, g: Game): boolean => isUserGame(l, g) && rollEvent(l, 'preGame', g)
/** Right after the user's game (and the day) is done. */
export const afterUserGame = (l: League, g: Game): boolean => isUserGame(l, g) && rollEvent(l, 'postGame', g)
/** A day the user doesn't play. */
export const onOffDay = (l: League): boolean => rollEvent(l, 'day', null)
