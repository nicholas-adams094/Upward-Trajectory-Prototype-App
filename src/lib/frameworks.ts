import type { CliftonDomain } from '../types'

/** The 34 CliftonStrengths themes grouped by their four domains. */
export const CLIFTON_THEMES: { theme: string; domain: CliftonDomain }[] = [
  ...['Achiever', 'Arranger', 'Belief', 'Consistency', 'Deliberative', 'Discipline', 'Focus', 'Responsibility', 'Restorative']
    .map((theme) => ({ theme, domain: 'Executing' as const })),
  ...['Activator', 'Command', 'Communication', 'Competition', 'Maximizer', 'Self-Assurance', 'Significance', 'Woo']
    .map((theme) => ({ theme, domain: 'Influencing' as const })),
  ...['Adaptability', 'Connectedness', 'Developer', 'Empathy', 'Harmony', 'Includer', 'Individualization', 'Positivity', 'Relator']
    .map((theme) => ({ theme, domain: 'Relationship Building' as const })),
  ...['Analytical', 'Context', 'Futuristic', 'Ideation', 'Input', 'Intellection', 'Learner', 'Strategic']
    .map((theme) => ({ theme, domain: 'Strategic Thinking' as const })),
]

export const DOMAIN_ORDER: CliftonDomain[] = ['Executing', 'Influencing', 'Relationship Building', 'Strategic Thinking']

export const DOMAIN_BLURB: Record<CliftonDomain, string> = {
  Executing: 'Makes things happen. Takes an idea and turns it into something delivered.',
  Influencing: 'Takes charge, speaks up and makes sure the team is heard.',
  'Relationship Building': 'The glue. Holds the team together and makes it more than the sum of its parts.',
  'Strategic Thinking': 'Absorbs and analyses information; helps the team make better decisions.',
}

export const ENNEAGRAM_TYPES: { type: number; name: string; motivation: string }[] = [
  { type: 1, name: 'The Reformer', motivation: 'To be right, good and beyond reproach.' },
  { type: 2, name: 'The Helper', motivation: 'To be needed and appreciated.' },
  { type: 3, name: 'The Achiever', motivation: 'To be valuable and worthwhile through visible accomplishment.' },
  { type: 4, name: 'The Individualist', motivation: 'To be authentic and significant.' },
  { type: 5, name: 'The Investigator', motivation: 'To be capable and self-sufficient.' },
  { type: 6, name: 'The Loyalist', motivation: 'To have security, support and certainty.' },
  { type: 7, name: 'The Enthusiast', motivation: 'To be satisfied, stimulated and free.' },
  { type: 8, name: 'The Challenger', motivation: 'To protect themselves and stay in control.' },
  { type: 9, name: 'The Peacemaker', motivation: 'To maintain inner and outer peace.' },
]

/** Behavioural anchors for the 1-5 rating scale used by every assessment. */
export const RATING_ANCHORS: Record<number, string> = {
  1: 'A significant development need — it gets in the way',
  2: 'Inconsistent — shows up in easy conditions only',
  3: 'Solid — meets the bar for the role',
  4: 'A strength — others notice and rely on it',
  5: 'A standout — the person others learn this from',
}
