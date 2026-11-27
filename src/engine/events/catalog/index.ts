import type { EventDef } from '../types'
import { DAY_EVENTS } from './days'
import { CAREER_EVENTS } from './career'
import { PLAYOFF_EVENTS } from './playoffs'
import { POST_GAME_EVENTS } from './postGame'
import { PRE_GAME_EVENTS } from './preGame'
import { REQUEST_EVENTS } from './requests'

/** Every pop-up event in the game. Category files add to this as the catalog grows. */
export const CATALOG: EventDef[] = [...PRE_GAME_EVENTS, ...REQUEST_EVENTS, ...POST_GAME_EVENTS, ...DAY_EVENTS, ...PLAYOFF_EVENTS]

export { CAREER_EVENTS }
