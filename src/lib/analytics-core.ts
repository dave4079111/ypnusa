import { readDb } from "./db";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeAnalyticsPulse() {
  const db = readDb();
  const events = [...db.analyticsEvents];
  const started = events.filter((event) => event.type === "intake_started").length;
  const completions = events.filter((event) => event.type === "intake_completed").length;
  const booked = events.filter((event) => event.type === "appointment_booked").length;

  const completionRatePct =
    started === 0 ? 0 : Math.round((Math.min(completions, started) / started) * 100);

  const demandTally = events.reduce<Record<string, number>>((memo, evt) => {
    if (
      evt.type === "intake_started" ||
      evt.type === "intake_completed" ||
      evt.type === "intake_progress"
    ) {
      const program =
        typeof evt.payload.program === "string" ? (evt.payload.program as string) : undefined;
      if (program) {
        memo[program] = (memo[program] ?? 0) + 1;
      }
    }
    return memo;
  }, {});

  const compositeScores = db.borrowerLeads.map((lead) => lead.qualification.programScores.overallScore ?? 0);

  let qualificationBands = {
    prime: 0,
    strong: 0,
    developing: 0,
    watch: 0,
  };

  db.borrowerLeads.forEach((lead) => {
    const band = lead.qualification.leadQuality;
    if (band === "prime") qualificationBands.prime += 1;
    if (band === "strong") qualificationBands.strong += 1;
    if (band === "developing") qualificationBands.developing += 1;
    if (band === "watch") qualificationBands.watch += 1;
  });

  const leadTotal = Math.max(db.borrowerLeads.length, 1);

  qualificationBands = {
    prime: Math.round((qualificationBands.prime / leadTotal) * 100),
    strong: Math.round((qualificationBands.strong / leadTotal) * 100),
    developing: Math.round((qualificationBands.developing / leadTotal) * 100),
    watch: Math.round((qualificationBands.watch / leadTotal) * 100),
  };

  const averageCompositeScore = Math.round(average(compositeScores));

  return {
    totals: {
      sessionsStarted: started,
      completions,
      bookings: booked,
    },
    funnel: demandTally,
    completionRatePct,
    qualificationMixPct: qualificationBands,
    bookingsCaptured: booked,
    averageLosCompositeScore: Number.isFinite(averageCompositeScore) ? averageCompositeScore : 0,
  };
}
