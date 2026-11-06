export type CounterResponse = {
  evidence_id: string;
  response: "accepted" | "rebutted" | "to_test";
  note: string;
};

export function unansweredCounterEvidence(
  againstIds: string[],
  responses: CounterResponse[],
) {
  const answered = new Set(responses.map((r) => r.evidence_id));
  return againstIds.filter((id) => !answered.has(id));
}

export function candidatesWithoutCounterSearch(
  candidates: string[],
  searches: { candidate: string | null; purpose: string }[],
) {
  const searched = new Set(
    searches.filter((s) => s.purpose === "counter").map((s) => s.candidate),
  );
  return candidates.filter((c) => !searched.has(c));
}
