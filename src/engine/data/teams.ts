import type { Conference } from '../types'

export interface ParodyTeam { city: string; name: string; abbrev: string; conf: Conference; primary: string; secondary: string }

const t = (conf: Conference, city: string, name: string, abbrev: string, primary: string, secondary: string): ParodyTeam =>
  ({ conf, city, name, abbrev, primary, secondary })

export const PARODY_TEAMS: ParodyTeam[] = [
  t('East', 'Atlanta', 'Squawks', 'ATL', '#c8102e', '#fdb927'),
  t('East', 'Boston', 'Kelptics', 'BOS', '#007a33', '#ba9653'),
  t('East', 'Brooklyn', 'Debts', 'BKN', '#111111', '#a1a1a4'),
  t('East', 'Charlotte', 'Hornots', 'CHA', '#1d1160', '#00788c'),
  t('East', 'Chicago', 'Bullies', 'CHI', '#ce1141', '#111111'),
  t('East', 'Cleveland', 'Cavapoos', 'CLE', '#860038', '#fdbb30'),
  t('East', 'Detroit', 'Pistachios', 'DET', '#93c572', '#1d428a'),
  t('East', 'Indiana', 'Placers', 'IND', '#002d62', '#fdbb30'),
  t('East', 'Miami', 'Sweat', 'MIA', '#98002e', '#f9a01b'),
  t('East', 'Milwaukee', 'Ducks', 'MIL', '#00471b', '#eee1c6'),
  t('East', 'New York', 'Knickknacks', 'NYK', '#006bb6', '#f58426'),
  t('East', 'Orlando', 'Tragic', 'ORL', '#0077c0', '#c4ced4'),
  t('East', 'Philadelphia', '67ers', 'PHI', '#006bb6', '#ed174c'),
  t('East', 'Toronto', 'Rappers', 'TOR', '#ce1141', '#000000'),
  t('East', 'Washington', 'Lizards', 'WAS', '#002b5c', '#e31837'),
  t('West', 'Dallas', 'Maybericks', 'DAL', '#00538c', '#b8c4ca'),
  t('West', 'Denver', 'Nuggies', 'DEN', '#0e2240', '#fec524'),
  t('West', 'Golden State', 'Worriers', 'GSW', '#1d428a', '#ffc72c'),
  t('West', 'Houston', 'Pockets', 'HOU', '#ce1141', '#c4ced4'),
  t('West', 'Los Angeles', 'Flippers', 'LAF', '#c8102e', '#1d428a'),
  t('West', 'Los Angeles', 'Fakers', 'LAK', '#552583', '#fdb927'),
  t('West', 'Memphis', 'Drizzlies', 'MEM', '#5d76a9', '#12173f'),
  t('West', 'Minnesota', 'Timberwoofs', 'MIN', '#0c2340', '#78be20'),
  t('West', 'New Orleans', 'Pelicants', 'NOP', '#0c2340', '#c8102e'),
  t('West', 'Oklahoma City', 'Blunder', 'OKC', '#007ac1', '#ef3b24'),
  t('West', 'Phoenix', 'Buns', 'PHX', '#1d1160', '#e56020'),
  t('West', 'Portland', 'Trail Grazers', 'POR', '#e03a3e', '#000000'),
  t('West', 'Sacramento', 'Things', 'SAC', '#5a2d81', '#63727a'),
  t('West', 'San Antonio', 'Slurps', 'SAS', '#c4ced4', '#000000'),
  t('West', 'Utah', 'Jazzercise', 'UTA', '#002b5c', '#f9a01b'),
]
