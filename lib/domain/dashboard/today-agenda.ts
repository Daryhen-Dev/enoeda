import type { SessionView } from "@/lib/domain/classes/actions";

/**
 * Agenda state for the dashboard overview ("Tinta y sello"): a session is
 * either sealed (attendance recorded — the only vermilion state), pending
 * (open ink, needs action), or suspended (prints grey, no attendance).
 */
export type TodayAgendaState = "sealed" | "pending" | "suspended";

export type TodayAgendaEntry = SessionView & { state: TodayAgendaState };

export interface TodayAgendaCounts {
  total: number;
  sealed: number;
  pending: number;
  suspended: number;
}

export interface TodayAgenda {
  entries: TodayAgendaEntry[];
  counts: TodayAgendaCounts;
}

/**
 * Pure derivation of the day's agenda: sessions sorted by start time, each
 * tagged with its ledger state, plus the per-state counts used by the
 * overview header summary.
 */
export function buildTodayAgenda(sessions: SessionView[]): TodayAgenda {
  const entries = [...sessions]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((session): TodayAgendaEntry => {
      if (session.status === "suspended") {
        return { ...session, state: "suspended" };
      }

      if ((session.attendance?.record_count ?? 0) > 0) {
        return { ...session, state: "sealed" };
      }

      return { ...session, state: "pending" };
    });

  const counts = entries.reduce<TodayAgendaCounts>(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.state] += 1;
      return acc;
    },
    { total: 0, sealed: 0, pending: 0, suspended: 0 }
  );

  return { entries, counts };
}
