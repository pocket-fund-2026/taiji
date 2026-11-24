// The wedding plan engine: turns a date, city, tradition, guest count and budget into a checklist, ceremonies, budget split
// and optional suggestions. Pure code with no imports, so the phone builds a plan with no internet, and the API's
// own plan code is tested against this one (api/src/email.test.ts) so the two can never drift apart.
// The rules below are copied from the server (server.ts, traditions.ts, extras.ts, planning-guide.ts).

// Original task wording, informed by the time-based approach in Brides and
// multi-event logistics in Marigold Events. Suggestions remain optional.
type GuideItem = readonly [key: string, title: string, daysBefore: number, phase: string, communities?: readonly string[]];
const HINDU = ['North Indian Hindu', 'South Indian', 'Bengali', 'Gujarati', 'Marathi', 'Jain', 'Tamil', 'Telugu', 'Malayali', 'Sindhi', 'Assamese'];
const SANGEET = ['North Indian Hindu', 'Gujarati', 'Punjabi/Sikh', 'Sindhi'];
export const GUIDE: readonly GuideItem[] = [
  ['priorities', 'Agree on your priorities together', 330, 'Foundations'],
  ['events', 'Choose the celebrations you want with both families', 330, 'Foundations'],
  ['guest_estimate', 'Estimate your guest count', 330, 'Foundations'],
  ['venue_visits', 'Visit venues and check capacity', 300, 'Foundations'],
  ['venue_rules', 'Ask venues about ceremony, fire, parking and vendor rules', 270, 'Venues'],
  ['event_guests', 'Estimate guest numbers for each celebration', 270, 'Guests'],
  ['catering', 'Compare caterers and plan a tasting', 270, 'Vendors'],
  ['photography', 'Shortlist photographers and videographers', 270, 'Vendors'],
  ['coverage', 'Agree which celebrations need photo and video coverage', 240, 'Vendors'],
  ['music', 'Choose music and entertainment', 240, 'Vendors'],
  ['design', 'Decide on colours and celebration style', 240, 'Design'],
  ['mandap', 'Plan mandap or ceremony decor with the venue', 210, 'Ceremony', HINDU],
  ['stay', 'Arrange guest accommodation if needed', 210, 'Guests'],
  ['outfits', 'Start shopping for wedding outfits', 210, 'Style'],
  ['invite_design', 'Plan invitation design and wording', 180, 'Guests'],
  ['officiant', 'Confirm your officiant and ceremony requirements', 180, 'Ceremony'],
  ['decor', 'Confirm flowers, decor and rentals', 150, 'Design'],
  ['mehndi', 'Confirm mehndi artists and timing if planned', 150, 'Style', ['North Indian Hindu', 'South Indian', 'Punjabi/Sikh', 'Muslim', 'Jain', 'Telugu', 'Sindhi']],
  ['transport', 'Plan transport for guests and family', 120, 'Logistics'],
  ['family_roles', 'Agree who in the family coordinates each event', 90, 'Logistics'],
  ['menu', 'Confirm your menu and dietary options', 90, 'Vendors'],
  ['rings', 'Arrange wedding rings if you want them', 90, 'Style'],
  ['beauty_trial', 'Schedule hair and makeup trials', 75, 'Style'],
  ['event_invites', 'Check invitations and RSVPs for every celebration', 75, 'Guests'],
  ['baraat', 'Confirm baraat route, music and permissions if planned', 60, 'Ceremony', ['North Indian Hindu', 'Gujarati', 'Punjabi/Sikh', 'Jain']],
  ['ceremony', 'Review ceremony details with your officiant', 60, 'Ceremony'],
  ['ritual_items', 'Confirm ceremony items and who brings them', 30, 'Ceremony'],
  ['sangeet_music', 'Collect performance music and share it with your DJ', 30, 'Final details', SANGEET],
  ['rsvp', 'Follow up on invitations and RSVPs', 30, 'Guests'],
  ['seating', 'Draft seating and accessibility needs', 30, 'Guests'],
  ['run_sheet', 'Give family and vendors a schedule for each event', 21, 'Final details'],
  ['final_headcount', 'Give vendors your final guest count', 14, 'Final details'],
  ['timeline', 'Share the day-of timeline and contacts', 14, 'Final details'],
  ['final_fitting', 'Confirm outfit fittings and collection', 7, 'Final details'],
  ['emergency_kit', 'Pack a small day-of essentials kit', 7, 'Final details'],
  ['thanks', 'Thank guests and the people who helped you', -21, 'After the wedding'],
];

export function guideForWedding(date: string, tasks: { title: string }[], now = new Date(), community = '') {
  const today = now.toISOString().slice(0, 10);
  const weddingDay = new Date(date + 'T00:00:00Z').getTime();
  const existing = new Set(tasks.map(t => t.title.toLocaleLowerCase()));
  return GUIDE.filter(([, , , , communities]) => !communities || !community || communities.includes(community)).map(([key, title, daysBefore, phase]) => {
    const ideal = new Date(weddingDay - daysBefore * 864e5).toISOString().slice(0, 10);
    // A short engagement brings past milestones forward without marking them overdue immediately.
    const due = date >= today && ideal < today ? today : ideal;
    return { key, title, phase, due, already_added: existing.has(title.toLocaleLowerCase()), is_catch_up: ideal < today && date >= today };
  });
}

const CHECK = [['Set wedding date & budget', -365], ['Book venue', -300], ['Book photographer', -240], ['Book makeup artist', -180], ['Finalise guest list', -120], ['Send save-the-dates', -90], ['Book decor & mehndi', -75], ['Send invites with RSVP link', -45], ['Final vendor payments', -7], ['Day-of run-of-show shared', -1]] as const;
// Starter tasks are timed back from the wedding day. On a short engagement the ones whose ideal date has
// already passed are spread a week apart from today, in order, instead of all starting out overdue.
export function starterDates(weddingDate: string, now: Date): [string, string][] {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const today = day(now.getTime()); const wedding = new Date(weddingDate + 'T00:00:00Z').getTime();
  const lastUseful = day(Math.max(now.getTime(), wedding - 864e5));
  let catchUp = 0;
  return CHECK.map(([title, offset]) => {
    const ideal = day(wedding + (offset as number) * 864e5);
    if (ideal >= today || weddingDate < today) return [title as string, ideal];
    const spread = day(now.getTime() + 7 * 864e5 * catchUp++);
    return [title as string, spread < lastUseful ? spread : lastUseful];
  });
}

const SPLIT: Record<string, number> = { venue: 30, caterer: 25, photographer: 10, decor: 12, makeup: 5, mehndi: 3, dj: 5, other: 10 };
export { SPLIT };

// Days after the wedding; added to every wedding once.
export const AFTER_TASKS: [string, number][] = [['Return rented outfits and jewellery', 3], ['Send thank-you messages to family and guests', 10],
  ['Leave reviews for your vendors', 14], ['Register the marriage', 30], ['Collect final photos and video', 45], ['Update name and address on documents (if needed)', 60]];
export const TEMPLATES: Record<string, string[]> = {
  'North Indian Hindu': ['Roka', 'Sagai', 'Haldi', 'Mehndi', 'Sangeet', 'Pheras', 'Reception'],
  'South Indian': ['Nischayathartham', 'Mehndi', 'Muhurtham', 'Reception'],
  'Bengali': ['Aiburobhat', 'Gaye Holud', 'Biye', 'Bou Bhaat'],
  'Gujarati': ['Griha Shanti', 'Mameru', 'Sangeet', 'Pheras', 'Reception'],
  'Marathi': ['Sakhar Puda', 'Halad', 'Mangal Snan', 'Lagna', 'Reception'],
  'Punjabi/Sikh': ['Roka', 'Mehndi', 'Sangeet', 'Anand Karaj', 'Reception'],
  'Muslim': ['Mangni', 'Mehndi', 'Nikah', 'Walima'],
  'Christian': ['Engagement', 'Church Wedding', 'Reception'],
  'Jain': ['Sagai', 'Mehndi', 'Pheras', 'Reception'],
  'Inter-faith': ['Court Registration', 'Cocktail', 'Reception'],
  // Regional additions: ceremony names are a starting point for families to edit, and should be reviewed with each community.
  'Tamil': ['Nichayathartham', 'Nalangu', 'Muhurtham', 'Reception'],
  'Telugu': ['Nischitartham', 'Pellikuthuru', 'Mangala Snanam', 'Pelli', 'Reception'],
  'Malayali': ['Engagement', 'Wedding', 'Reception'],
  'Sindhi': ['Sagai', 'Mehndi', 'Sangeet', 'Lavan Phere', 'Reception'],
  'Parsi': ['Roce', 'Madavsaro', 'Adravanu', 'Lagan', 'Reception'],
  'Assamese': ['Juran Diya', 'Tel Diya', 'Biya', 'Reception'],
};

export type PlanInput = { date: string; city: string; community?: string; guests_est?: number; budget_paise: number };
export type PlanTask = { title: string; due: string; done: boolean };
export type BuiltPlan = {
  wedding: { date: string; city: string; community: string; guests_est: number; budget_paise: number };
  tasks: PlanTask[]; events: { name: string; date: string }[]; budget: { category: string; allocated_paise: number }[];
  suggestions: ReturnType<typeof guideForWedding>;
};
const dayOf = (iso: string, add: number) => new Date(+new Date(iso + 'T00:00:00Z') + add * 864e5).toISOString().slice(0, 10);

/** Returns an error message when the input cannot make a plan, otherwise null. */
export function checkPlanInput(i: Partial<PlanInput>): string | null {
  if (!i.date || !/^\d{4}-\d{2}-\d{2}$/.test(i.date) || new Date(i.date + 'T00:00:00Z').toISOString().slice(0, 10) !== i.date) return 'Enter a real calendar date';
  if (!i.city || !i.city.trim()) return 'Choose your wedding city';
  if (!Number.isInteger(i.budget_paise) || (i.budget_paise as number) <= 0 || (i.budget_paise as number) > 100_000_000_000) return 'Enter a rough total budget';
  return null;
}

/** Builds the plan. `now` is today's date, passed in so results are repeatable in tests. */
export function buildPlan(input: PlanInput, now: Date = new Date()): BuiltPlan {
  const community = input.community || 'North Indian Hindu';
  const w = { date: input.date, city: input.city.trim(), community, guests_est: input.guests_est && input.guests_est > 0 ? Math.floor(input.guests_est) : 200, budget_paise: input.budget_paise };
  const tasks: PlanTask[] = [
    ...starterDates(w.date, now).map(([title, due]) => ({ title, due, done: title === 'Set wedding date & budget' })),
    ...AFTER_TASKS.map(([title, off]) => ({ title, due: dayOf(w.date, off), done: false })),
  ];
  const names = TEMPLATES[community] || TEMPLATES['North Indian Hindu'];
  const events = names.map((name, i) => ({ name, date: dayOf(w.date, -(names.length - 1 - i)) }));
  const budget = Object.entries(SPLIT).map(([category, p]) => ({ category, allocated_paise: Math.round(w.budget_paise * p / 100) }));
  return { wedding: w, tasks, events, budget, suggestions: guideForWedding(w.date, tasks, now, community).filter(s => !s.already_added) };
}
