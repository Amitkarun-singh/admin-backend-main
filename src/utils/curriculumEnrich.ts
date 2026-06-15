/**
 * curriculumEnrich.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared curriculum-enrichment helpers.
 *
 * The curriculum microservice is the SINGLE source of truth for:
 *   • class names  (returned as { id, class_name, ... })
 *   • section names (returned as { id, section_name, ... })
 *   • subject names (returned as { id, subject_name | name, ... })
 *   • stream names  (returned as { id, stream_name, ... })
 *
 * All services/controllers should import and use these helpers instead of
 * calling curriculumService directly, to keep the enrichment logic in one place.
 */

import curriculumService from "../services/curriculum.service.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CurriculumMaps {
  classMap:   Map<number, string>;   // id → class_name
  sectionMap: Map<number, string>;   // id → section_name
  streamMap:  Map<number, string>;   // id → stream_name
  /** Raw class list — use when you need { id, class_name } for further subject lookups */
  classes:    any[];
  sections:   any[];
  streams:    any[];
}

// ─── Core fetch ──────────────────────────────────────────────────────────────

/**
 * Fetches classes, sections, and streams in parallel.
 * On failure throws ApiError(503) so the caller gets a clear error.
 */
export async function fetchCurriculumMaps(): Promise<CurriculumMaps> {
  try {
    const [classesRaw, sectionsRaw, streamsRaw] = await Promise.all([
      curriculumService.allClass(),
      curriculumService.section(),
      curriculumService.stream(),
    ]);

    const classes:  any[] = classesRaw?.data  ?? classesRaw  ?? [];
    const sections: any[] = sectionsRaw?.data ?? sectionsRaw ?? [];
    const streams:  any[] = streamsRaw?.data  ?? streamsRaw  ?? [];

    const classMap   = new Map<number, string>(classes.map( (c: any) => [Number(c.id ?? c.class_id),   String(c.class_name)]));
    const sectionMap = new Map<number, string>(sections.map((s: any) => [Number(s.id ?? s.section_id), String(s.section_name)]));
    const streamMap  = new Map<number, string>(streams.map( (st: any) => [Number(st.id ?? st.stream_id), String(st.stream_name ?? st.name ?? "")]));

    return { classMap, sectionMap, streamMap, classes, sections, streams };
  } catch (err: any) {
    // Rethrow with a descriptive message; caller can catch and degrade gracefully
    throw new Error(`Curriculum service unavailable: ${err?.message ?? "unknown"}`);
  }
}

/**
 * Safe version: on failure returns empty maps (no names) rather than throwing.
 * Use this in read/list endpoints where a partial response is better than 503.
 */
export async function fetchCurriculumMapsSafe(): Promise<CurriculumMaps> {
  try {
    return await fetchCurriculumMaps();
  } catch {
    return {
      classMap:   new Map(),
      sectionMap: new Map(),
      streamMap:  new Map(),
      classes:    [],
      sections:   [],
      streams:    [],
    };
  }
}

// ─── Subject lookup (per-class) ───────────────────────────────────────────────

/**
 * Fetch all subjects for a given classId (and optional board/streamId).
 * Returns an ID → subject_name map.
 */
export async function fetchSubjectMapForClass(
  classId: number | string,
  board   = "",
  streamId: number | string = 4,
): Promise<Map<number, string>> {
  try {
    const raw  = await curriculumService.allSubject(classId, board, streamId);
    const list: any[] = raw?.data ?? raw ?? [];
    return new Map(list.map((s: any) => [Number(s.id ?? s.subject_id), String(s.subject_name ?? s.name)]));
  } catch {
    return new Map();
  }
}

// ─── Object-enrichment helpers ────────────────────────────────────────────────

/**
 * Attaches class_name and section_name to a single `classSection` sub-object
 * (as returned by StudentClassSection Sequelize include).
 */
export function enrichClassSection(
  cs: any,
  maps: Pick<CurriculumMaps, "classMap" | "sectionMap">,
): any {
  if (!cs) return cs;
  const classId   = Number(cs.class_id);
  const sectionId = Number(cs.section_id);
  cs.class   = maps.classMap.get(classId)   ? { class_id:   classId,   class_name:   maps.classMap.get(classId)!   } : null;
  cs.section = maps.sectionMap.get(sectionId) ? { section_id: sectionId, section_name: maps.sectionMap.get(sectionId)! } : null;
  return cs;
}

/**
 * Attaches class_name and section_name to each assignment in a teacher's
 * `assignments[]` array.  Subject name lookup is deferred to the caller if needed
 * (it requires per-class API calls).
 */
export function enrichTeacherAssignments(
  assignments: any[],
  maps: Pick<CurriculumMaps, "classMap" | "sectionMap">,
): any[] {
  if (!assignments?.length) return assignments ?? [];
  return assignments.map((a) => ({
    ...a,
    class_name:   maps.classMap.get(Number(a.class_id))   ?? null,
    section_name: maps.sectionMap.get(Number(a.section_id)) ?? null,
  }));
}
