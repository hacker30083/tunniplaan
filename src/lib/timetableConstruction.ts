import { getLessonsForGroup } from "./timetableHelper";
import { getLessonTimes, getProTERABreaksForDay } from "./proteraRules";
import type { GroupSelectionState, TimetableItem } from "../types/timetable";

export interface DayItem {
	key: string;
	title: string;
	startTime: string;
	endTime: string;
	location?: string;
	name?: string | false;
	isBreak: boolean;
	// How many squares this item takes up in the day's row. Double lessons
	// take 2; everything else (single lessons, breaks) takes 1.
	width: number;
}

function pushItem(
	timetable: TimetableItem[],
	x: number,
	y: number,
	title = "-",
	startTime?: string,
	endTime?: string,
	location?: string,
	name?: string | false,
	isBreak = false,
	w = 1
): void {
	const time = startTime ? (endTime ? `${startTime} - ${endTime}` : startTime) : (endTime ?? "-");
	const item: TimetableItem = { x, y, title, time, w };

	if (location) {
		item.location = location;
	}
	if (name) {
		item.name = name;
	}
	if (isBreak) {
		item.isBreak = true;
	}

	timetable.push(item);
}

function timeToMinutes(time: string): number {
	const [hoursPart, minutesPart] = time.split(":");
	const hours = parseInt(hoursPart, 10) || 0;
	const minutes = parseInt(minutesPart, 10) || 0;
	return hours * 60 + minutes;
}

export function buildTimetableFromLiveData(grData: GroupSelectionState | null): TimetableItem[] {
	const timetable: TimetableItem[] = [];
	if (!grData?.structuredData) {
		return timetable;
	}

	const { structuredData, groups } = grData;
	const useProTERATimeRules = grData.useProTERATimeRules === true;

	const allLessons = Object.entries(groups).flatMap(([selectionID, groupID]) => {
		// Subject-based selections use `<division id>::<subject id>`.  The
		// division scopes a subject selection in the setup UI; the subject ID
		// is what identifies the lessons to render.
		const separatorIndex = String(selectionID).lastIndexOf("::");
		const subjectID = separatorIndex === -1
			? ""
			: String(selectionID).slice(separatorIndex + 2);
		const lessons = getLessonsForGroup(structuredData, groupID);
		return subjectID
			? lessons.filter((lessonData) => String(lessonData.lesson.subject?.id ?? "") === subjectID)
			: lessons;
	});

	// Each day's real lessons, collected first so we know (a) their actual
	// times and (b) whether the day has a "long third lesson" before we
	// decide which breaks apply.
	const lessonsByDay: DayItem[][] = Array.from({ length: 5 }, () => []);
	const hasLongThirdLessonByDay: boolean[] = new Array(5).fill(false);

	for (const lessonData of allLessons) {
		if (!lessonData?.lesson || !lessonData.time) {
			continue;
		}

		const dayIndex = lessonData.time.day - 1;
		if (dayIndex < 0 || dayIndex >= lessonsByDay.length) {
			continue;
		}

		const title = lessonData.lesson.subject?.name ?? "Tund";
		const period = lessonData.time.period;
		const length = Math.max(1, parseInt(String(lessonData.time.length), 10) || 1);
		const { startTime, endTime } = getLessonTimes(period, length, useProTERATimeRules, hasLongThirdLessonByDay[dayIndex]);
		const roomText = lessonData.room.join(", ");
		const teacher = lessonData.lesson.teacher;
		const teacherText = Array.isArray(teacher) ? teacher.join(", ") : teacher ?? undefined;

		lessonsByDay[dayIndex].push({
			key: `lesson-${dayIndex}-${period}-${title}-${teacherText ?? ""}-${roomText}`,
			title,
			startTime,
			endTime,
			location: roomText,
			name: teacherText ?? false,
			isBreak: false,
			// Same clamp as getLessonTimes: anything double-length-or-longer
			// takes 2 squares, single periods take 1.
			width: length >= 2 ? 2 : 1
		});

		if (useProTERATimeRules && period === 5 && length >= 2) {
			hasLongThirdLessonByDay[dayIndex] = true;
		}
	}

	for (let dayIndex = 0; dayIndex < lessonsByDay.length; dayIndex += 1) {
		const dayLessons = lessonsByDay[dayIndex];

		// Lessons and breaks for the day live in one list, ordered purely by
		// when they actually happen. There's no shared grid to place them
		// on, so there's nothing for two items to collide over — each just
		// gets the next position once everything is sorted by start time.
		const dayItems: DayItem[] = [...dayLessons];

		if (useProTERATimeRules) {
			const breaks = getProTERABreaksForDay(dayLessons, hasLongThirdLessonByDay[dayIndex]);
			breaks.forEach((brk, breakIndex) => {
				dayItems.push({
					key: `break-${dayIndex}-${breakIndex}-${brk.title}`,
					title: brk.title,
					startTime: brk.startTime,
					endTime: brk.endTime,
					isBreak: true,
					width: 1
				});
			});
		}

		dayItems.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

		// x advances by each item's width rather than by a plain 1-per-item
		// count, so a double lesson's neighbour starts two squares over
		// instead of landing right on top of it.
		let x = 0;
		for (const item of dayItems) {
			pushItem(
				timetable,
				x,
				dayIndex,
				item.title,
				item.startTime,
				item.endTime,
				item.location,
				item.name,
				item.isBreak,
				item.width
			);
			x += item.width;
		}
	}

	return timetable;
}