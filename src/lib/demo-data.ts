function randInt(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ANCHOR = {
  headline: "Free food was the strongest single signal",
  evidence: "Avg 14 attendees at events with food vs 6 without, across 5 vs 3 events.",
};

function pool() {
  return [
    {
      headline: `On-campus events outpaced off-campus by ~${randInt(3, 7)} attendees`,
      evidence: `Avg ${randInt(12, 16)} on-campus across 6 events vs ${randInt(6, 10)} off-campus across 3 events.`,
    },
    {
      headline: `Friday socials drew higher attendance than weeknight studies`,
      evidence: `Avg ${randInt(13, 18)} on Fridays across 4 events vs ${randInt(6, 9)} on weeknights across 3 events.`,
    },
    {
      headline: `Invite ratio is strongest at worship-themed events`,
      evidence: `~${randInt(30, 40)}% of new attendees came via existing-student invites at worship events; ~${randInt(10, 20)}% at studies.`,
    },
    {
      headline: `October was the strongest month so far`,
      evidence: `October avg ${randInt(13, 17)} over 4 events; September avg ${randInt(8, 12)} over 5 events.`,
    },
    {
      headline: `Returner rate has been stable around ~${randInt(65, 75)}%`,
      evidence: `Returner ratio: 0.${randInt(67, 72)}, 0.${randInt(68, 73)}, 0.${randInt(67, 74)} over the last 3 weeks.`,
    },
    {
      headline: `First-time attendance trended down late semester`,
      evidence: `New attendees: ${randInt(7, 9)} in week 3, ${randInt(4, 6)} in week 6, ${randInt(1, 3)} in week 9.`,
    },
    {
      headline: `Invite chains concentrated in 3 core students`,
      evidence: `~${randInt(55, 65)}% of new attendees were brought by just 3 people; the rest of the roster invited fewer than 2 each.`,
    },
    {
      headline: `Weekly avg drifted upward through the term`,
      evidence: `Weekly avg: ${randInt(7, 9)} (Sept), ${randInt(10, 12)} (Oct), ${randInt(13, 16)} (Nov).`,
    },
  ];
}

export function mockInsights() {
  const p = shuffle(pool());
  const n = randInt(2, 4);
  return [ANCHOR, ...p.slice(0, n)];
}

export const DEMO_NOTICE =
  "AI features are disabled in this demo. Fork the repo, add your own Anthropic API key, and self-host to unlock parsing, ask, modify, and live insights.";
