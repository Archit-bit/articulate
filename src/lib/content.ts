// Practice material. Edit freely — add topics from your own work.

export type TopicCategory = 'Business' | 'Opinion' | 'Story' | 'Explain' | 'On the spot';

export const TOPICS: { cat: TopicCategory; text: string }[] = [
  // Business
  { cat: 'Business', text: 'Should a small company build its own AI product or build on top of existing ones?' },
  { cat: 'Business', text: 'What makes a vendor trustworthy in the first meeting?' },
  { cat: 'Business', text: 'Why do most software projects run late — and what would you do about it?' },
  { cat: 'Business', text: 'Is it better to be first to market or best in market?' },
  { cat: 'Business', text: 'How would you convince a government department to try something new?' },
  { cat: 'Business', text: 'What is the most underrated skill in sales?' },
  { cat: 'Business', text: 'Your first 90 days as head of a five-person sales team: what do you do?' },
  { cat: 'Business', text: 'Should a startup chase big enterprise clients or many small ones?' },
  { cat: 'Business', text: 'Is the customer always right?' },
  { cat: 'Business', text: 'What would make you walk away from a deal?' },
  { cat: 'Business', text: 'How do you price something nobody has bought before?' },
  { cat: 'Business', text: 'Will AI replace sales people, or make them more valuable?' },
  // Opinion
  { cat: 'Opinion', text: 'Are exams a good measure of ability?' },
  { cat: 'Opinion', text: 'Should everyone learn to code?' },
  { cat: 'Opinion', text: 'Is social media making us better or worse communicators?' },
  { cat: 'Opinion', text: 'Big city or small town: where would you build your life, and why?' },
  { cat: 'Opinion', text: 'Is it better to be a specialist or a generalist?' },
  { cat: 'Opinion', text: 'Should work from home be a right?' },
  { cat: 'Opinion', text: 'Is ambition overrated?' },
  { cat: 'Opinion', text: 'Does a degree still matter?' },
  { cat: 'Opinion', text: 'Is it ever right to lie to a client?' },
  { cat: 'Opinion', text: 'What is one rule every workplace should have?' },
  // Story
  { cat: 'Story', text: 'Tell me about a time you changed someone’s mind.' },
  { cat: 'Story', text: 'The best advice you ever ignored.' },
  { cat: 'Story', text: 'A mistake that taught you something you still use.' },
  { cat: 'Story', text: 'Describe a day when everything went wrong — and how it ended.' },
  { cat: 'Story', text: 'A person who shaped how you work.' },
  { cat: 'Story', text: 'The hardest conversation you have had at work.' },
  { cat: 'Story', text: 'A small win you are proud of.' },
  { cat: 'Story', text: 'A time you had to learn something very fast.' },
  // Explain
  { cat: 'Explain', text: 'Explain “trust” without using the word trust.' },
  { cat: 'Explain', text: 'Explain cricket to someone who has never seen it.' },
  { cat: 'Explain', text: 'Explain the internet to a 10-year-old.' },
  { cat: 'Explain', text: 'Explain what an API is to your parents.' },
  { cat: 'Explain', text: 'What does “success” mean to you?' },
  { cat: 'Explain', text: 'Explain why UPI changed how India pays.' },
  { cat: 'Explain', text: 'Explain how a large language model works, in plain words.' },
  { cat: 'Explain', text: 'Explain what you do for a living to a stranger at a wedding.' },
  // On the spot
  { cat: 'On the spot', text: 'Your client asks for a 30% discount on the call. Respond.' },
  { cat: 'On the spot', text: 'You are 20 minutes late to a client meeting. Walk in and open the meeting.' },
  { cat: 'On the spot', text: 'The demo just crashed in front of the client. What do you say?' },
  { cat: 'On the spot', text: 'A senior officer asks: “Why should we trust a small company like yours?”' },
  { cat: 'On the spot', text: 'You have 60 seconds with the CEO in the lift. Go.' },
  { cat: 'On the spot', text: 'A client says your competitor is half your price. Respond.' },
  { cat: 'On the spot', text: 'Introduce yourself to a room of 50 people at a conference.' },
  { cat: 'On the spot', text: 'Give a toast at a colleague’s farewell.' },
  { cat: 'On the spot', text: 'Someone asks a question you don’t know the answer to. Handle it.' },
  { cat: 'On the spot', text: 'Your team missed a deadline. Update the client.' },
];

export const REPHRASE_SEEDS: { text: string; context: string }[] = [
  { text: 'The project will be two weeks late because your team didn’t send the data on time.', context: 'Telling a client' },
  { text: 'We can’t build this feature in the current budget.', context: 'Client asking for more' },
  { text: 'Your payment is 45 days overdue.', context: 'Following up with a client' },
  { text: 'I disagree with your approach. I think it will fail.', context: 'Talking to a senior' },
  { text: 'That’s out of scope, so we’ll have to charge extra.', context: 'Scope creep' },
  { text: 'I need more time to finish this.', context: 'Talking to your manager' },
  { text: 'This is not technically possible in two weeks.', context: 'Client with an unrealistic deadline' },
  { text: 'We made a mistake in the last release and some reports were wrong.', context: 'Owning a mistake with a client' },
  { text: 'Our price is higher than the other vendor, but we’re better.', context: 'Price objection' },
  { text: 'Can you introduce me to the person who actually decides?', context: 'Reaching the decision-maker' },
  { text: 'Please stop changing the requirements every week.', context: 'Client keeps changing scope' },
  { text: 'I don’t know the answer to that right now.', context: 'Tough question in a meeting' },
  { text: 'We need your approval by Friday or the timeline slips.', context: 'Chasing a decision' },
  { text: 'Your current software is outdated and it’s costing you money.', context: 'Pitching a replacement' },
  { text: 'I’m not the right person for this — talk to my colleague.', context: 'Redirecting a request' },
  { text: 'We lost the tender.', context: 'Telling your team' },
  { text: 'I think I deserve a bigger role.', context: 'Talking to your boss' },
  { text: 'Your team member isn’t cooperating with us.', context: 'Escalating to a client manager' },
  { text: 'We can start only after you pay the advance.', context: 'Payment terms' },
  { text: 'The pilot results were not as good as we hoped.', context: 'Reporting to a client' },
];

export const REPHRASE_STYLES = [
  {
    id: 'simple',
    name: 'Plain & simple',
    brief: 'Short words, one breath, zero jargon. Like you’d say it to a friend — but still correct.',
  },
  {
    id: 'diplomatic',
    name: 'Diplomatic & formal',
    brief: 'For a senior client or a government officer. Polite and respectful — without sounding weak or apologetic.',
  },
  {
    id: 'persuasive',
    name: 'Persuasive',
    brief: 'Frame it around their benefit and end by moving towards a clear next step.',
  },
] as const;

export const EXPLAIN_PRESETS = [
  { what: 'What my company does', audience: 'A potential client you just met at an event' },
  { what: 'My latest project and why it matters', audience: 'A senior decision-maker who is not technical' },
  { what: 'How AI / large language models actually work', audience: 'A government officer who is curious but sceptical' },
  { what: 'Why a client should choose us over a cheaper vendor', audience: 'A price-focused purchase manager' },
  { what: 'What I want to do in the next five years', audience: 'An interviewer' },
];

export const EXPLAIN_ROUNDS = [120, 60, 20];

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  persona: string;
  situation: string;
  goal: string;
  concerns: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'psu',
    title: 'Defence PSU officer',
    blurb: 'First pitch to a sceptical, process-driven buyer',
    persona:
      'Mr. Rao, Deputy General Manager (IT) at a defence public-sector undertaking. Formal, careful, has been burned by vendors who over-promised. Procurement goes through GeM and strict security norms.',
    situation: 'First meeting. The vendor is pitching an AI software solution for your department.',
    goal: 'Get agreement for a follow-up technical demo with his team.',
    concerns:
      'Data cannot leave the premises (on-prem / air-gapped?); security certifications; references from other PSUs; GeM listing and L1 pricing; who maintains it after delivery.',
  },
  {
    id: 'hospital',
    title: 'Hospital administrator',
    blurb: 'Busy, cost-focused, worried about staff adoption',
    persona:
      'Dr. Mehta, Medical Superintendent of a 300-bed private hospital. Very busy, practical, thinks in rupees and patient safety.',
    situation: 'A 20-minute slot between rounds. The vendor wants to pitch software for the hospital.',
    goal: 'Agree to a small pilot in one department.',
    concerns:
      'Integration with the existing hospital information system; staff will not adopt new software; patient data privacy; ROI in rupees; what happens when the software is wrong.',
  },
  {
    id: 'pharma',
    title: 'Pharma distributor owner',
    blurb: 'Happy with his old software — why switch?',
    persona:
      'Mr. Agarwal, owner of a mid-sized pharma distribution business. Has used the same billing and inventory software for 10 years; his staff know it well. Friendly but sharp about money.',
    situation: 'He agreed to meet because a friend recommended the vendor.',
    goal: 'Get him to try a free demo with his own data.',
    concerns:
      'Switching cost and data migration; why not stay with the current software; retraining staff; price compared with his current AMC; support response time.',
  },
  {
    id: 'plant',
    title: 'Manufacturing plant head',
    blurb: 'Wants proof, not slides',
    persona:
      'Ms. Iyer, Plant Head at an auto-components manufacturing plant. Engineer by training, data-driven, allergic to buzzwords.',
    situation: 'Meeting on the plant premises about a technology solution for shop-floor workers.',
    goal: 'Agree a paid 4-week pilot on one production line.',
    concerns:
      'Workers are not tech-savvy; proof of productivity gains; pilot before commitment; hardware durability and cost; IT/OT security.',
  },
  {
    id: 'delay',
    title: 'Unhappy existing client',
    blurb: 'The project is late. Keep the relationship.',
    persona:
      'Mr. Khanna, Project Sponsor at a client company. Normally reasonable, but his boss is now asking him questions and he is frustrated.',
    situation: 'The project is three weeks behind schedule. He called this meeting.',
    goal: 'Keep his trust and agree a realistic recovery plan — without accepting blame that isn’t yours.',
    concerns:
      'Why the delay; who is accountable; can you commit to a new date; the penalty clause; whether to bring in another vendor.',
  },
  {
    id: 'interview',
    title: 'Interview panel',
    blurb: 'Admissions or job interview',
    persona:
      'Prof. Sen, a panel interviewer. Polite, probing, notices rehearsed answers and asks follow-ups to get past them.',
    situation: 'A 15-minute interview for a competitive program or role.',
    goal: 'Come across as clear, genuine and motivated.',
    concerns:
      'Tell me about yourself; why this and why now; a weakness; a gap or a low grade; what you will do after; a question you do not expect.',
  },
  {
    id: 'custom',
    title: 'Custom',
    blurb: 'Rehearse a real meeting you have coming up',
    persona: '',
    situation: '',
    goal: '',
    concerns: '',
  },
];

export const DIFFICULTY = {
  friendly: 'You are warm and open, but still ask real questions and expect real answers.',
  realistic:
    'You are polite but busy and a little sceptical — you have met many vendors. You ask pointed follow-ups when answers are vague.',
  tough:
    'You are impatient, sceptical and short on time. You push back hard on price and claims, cut off long answers ("Sorry — what is the bottom line?"), and sometimes go off on a tangent the other person has to steer back.',
} as const;
export type Difficulty = keyof typeof DIFFICULTY;

export const VOICES = ['', 'Charon', 'Puck', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];

export function pick<T>(arr: readonly T[], avoid?: T): T {
  if (arr.length < 2) return arr[0];
  let x = arr[Math.floor(Math.random() * arr.length)];
  while (x === avoid) x = arr[Math.floor(Math.random() * arr.length)];
  return x;
}
