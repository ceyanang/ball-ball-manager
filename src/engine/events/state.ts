import type { Phase } from '../types'

export type EventFrequency = 'off' | 'some' | 'lots'

/** Who a pop-up is about. Ids only, so a pending event survives a save/reload. */
export interface Subjects { playerIds: string[]; coachId?: string; teamId?: string; opponentId?: string }

export interface PendingEvent { eventId: string; season: number; phase: Phase; day: number; subjects: Subjects }

/** A temporary modifier handed to the sim (never an edit to ratings). `playerId` null = the whole user team. */
export interface ActiveEffect {
  id: string; kind: 'shooting' | 'defense' | 'energy' | 'all'; playerId: string | null; amount: number; gamesLeft: number; rest?: boolean
}

export interface EventLogEntry {
  eventId: string; season: number; day: number; title: string; choice: string; outcomeText: string
  tone: 'good' | 'bad' | 'neutral'; changes: string[]
}

export interface EventsState {
  frequency: EventFrequency
  pending: PendingEvent | null
  active: ActiveEffect[]
  history: EventLogEntry[]
  /** eventId → first day it may fire again. */
  cooldowns: Record<string, number>
  /** The last day/slot that was rolled, so answering an event never re-rolls the same moment. */
  rolled: { season: number; phase: Phase; day: number; slot: 'pre' | 'day' | 'post' } | null
}

export const emptyEvents = (): EventsState => ({ frequency: 'lots', pending: null, active: [], history: [], cooldowns: {}, rolled: null })
