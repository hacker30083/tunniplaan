// ProTERA bell-schedule rules.
//
// Real class times are looked up directly per (period, length) instead of
// going through a shared grid of "slots" — there is no positional index for
// lessons/breaks to collide over here, only clock times.

import type { DayItem } from "./timetableConstruction.ts";

export interface LessonTimes {
	startTime: string;
	endTime: string;
}

export interface ProTERABreakDefinition {
	title: string;
	startTime: string;
	endTime: string;
}

interface DayLessonTime {
	startTime: string;
	endTime: string;
}

export function isLiikumisopetusTitle(title: string): boolean {
	return String(title ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.includes("liikumis");
}

/**
 * The real-world bell schedule, expressed directly as period + lesson
 * length -> clock time. This replaces the old period -> grid-slot ->
 * time-boundary-array indirection.
 *
 * Sourced from the "ProTERA päevakava" chart. Most periods only change
 * under ProTERA rules for periods 3, 5, 6, 7, 8, 9 — outside those, the
 * schedule is the same regardless of `useProTERATimeRules`.
 *
 * Lengths above 2 are treated the same as length 2 (the source schedule
 * doesn't define anything beyond a double period).
 */
export function getLessonTimes(period: number, length: number, useProTERATimeRules: boolean, hasLongThirdLesson: boolean): LessonTimes {
	const isDouble = length >= 2;

	switch (period) {
		case 0:
		case 1:
			return isDouble
				? { startTime: "9:00", endTime: "10:20" }
				: { startTime: "9:00", endTime: "9:35" };

		case 2:
			return isDouble
				? { startTime: "9:35", endTime: "10:30" }
				: { startTime: "9:35", endTime: "10:20" };

		case 3:
			// ProTERA: "2. TUND" is always a fixed 10:30-11:50 slot (no
			// double variant in the chart). Non-ProTERA schedule is left as
			// it was — this chart doesn't cover that case.
			if (useProTERATimeRules) {
				return { startTime: "10:30", endTime: "11:50" };
			}
			return isDouble
				? { startTime: "10:20", endTime: "11:50" }
				: { startTime: "10:20", endTime: "10:30" };

		case 4:
			return isDouble
				? { startTime: "11:50", endTime: "13:35" }
				: { startTime: "11:50", endTime: "12:50" };

		case 5:
			// The "third lesson" — a double period here means the afternoon
			// break gets pushed later (see getProTERABreaksForDay).
			if (isDouble) {
				return useProTERATimeRules
					? { startTime: "12:50", endTime: "14:10" }
					: { startTime: "12:50", endTime: "13:55" };
			}
			return { startTime: "12:50", endTime: "13:35" };

		case 6:
			if (useProTERATimeRules) {
				return hasLongThirdLesson
					? (isDouble ? { startTime: "14:30", endTime: "15:50" } : { startTime: "14:30", endTime: "15:15" })
					: (isDouble ? { startTime: "13:55", endTime: "15:15" } : { startTime: "13:55", endTime: "14:40" });
			}
			return isDouble
				? { startTime: "13:55", endTime: "14:30" }
				: { startTime: "13:55", endTime: "14:10" };

		case 7:
			if (useProTERATimeRules) {
				return hasLongThirdLesson
					? { startTime: "15:20", endTime: "16:05" }
					: { startTime: "14:45", endTime: "15:30" };
			}
			return isDouble
				? { startTime: "14:10", endTime: "15:15" }
				: { startTime: "14:10", endTime: "14:30" };

		case 8:
			// ProTERA "5. TUND", short-path branch (after the short 4th
			// lesson that ended 14:40). Always a single period in the
			// chart, so length doesn't branch this one.
			if (useProTERATimeRules) {
				return { startTime: "14:45", endTime: "15:30" };
			}
			return isDouble
				? { startTime: "14:30", endTime: "16:05" }
				: { startTime: "14:30", endTime: "15:15" };

		case 9:
		default:
			// ProTERA "5. TUND", long-path branch (after a 4th lesson that
			// ended 15:15, whichever branch it came from).
			if (useProTERATimeRules) {
				return { startTime: "15:20", endTime: "16:05" };
			}
			return { startTime: "15:15", endTime: "16:05" };
	}
}

function timeToMinutes(time: string): number {
	const [hoursPart, minutesPart] = time.split(":");
	const hours = parseInt(hoursPart, 10) || 0;
	const minutes = parseInt(minutesPart, 10) || 0;
	return hours * 60 + minutes;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
	return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

/**
 * Returns the ProTERA breaks that apply to a day, given that day's real
 * lessons. A break is only included if it doesn't time-overlap a lesson
 * that's actually scheduled that day — so a break can never clash with or
 * displace a real class.
 */
export function getProTERABreaksForDay(
	dayLessons: DayLessonTime[],
	hasLongThirdLesson: boolean
): ProTERABreakDefinition[] {
	const candidates: ProTERABreakDefinition[] = [
		{ title: "Pro", startTime: "11:50", endTime: "12:50" },
		{ title: "Amps", startTime: "13:35", endTime: "13:55" }
	];

	if (hasLongThirdLesson) {
		// A long (double) third lesson pushes the afternoon break later.
		candidates.push({ title: "Amps", startTime: "14:10", endTime: "14:30" });
	}

	return candidates.filter(
		(candidate) =>
			!dayLessons.some((lesson) => overlaps(candidate.startTime, candidate.endTime, lesson.startTime, lesson.endTime))
	);
}