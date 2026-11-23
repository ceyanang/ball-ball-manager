import type { EventDef } from '../types'
import { PRE_GAME_EVENTS } from './preGame'
import { REQUEST_EVENTS } from './requests'

/** Every pop-up event in the game. Category files add to this as the catalog grows. */
export const CATALOG: EventDef[] = [...PRE_GAME_EVENTS, ...REQUEST_EVENTS]
