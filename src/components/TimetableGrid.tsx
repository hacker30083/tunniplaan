import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { fitTimetableText } from "../lib/timetableTextFit";
import type { TimetableItem } from "../types/timetable";

const WEEKDAYS = ["E", "T", "K", "N", "R"];

function getCurrentWeekday(): number {
	return [0, 0, 1, 2, 3, 4, 0][new Date(Date.now() + 25e6).getDay()];
}

function shortenName(value: string): string {
	return value
		.split("/")
		.map((part) => {
			const nameParts = part.trim().split(" ");
			if (nameParts.length === 0) {
				return part.trim();
			}
			const first = nameParts[0]?.split("-")[0] ?? "";
			const lastInitial = nameParts.at(-1)?.split("-")[0]?.[0] ?? "";
			return `${first} ${lastInitial}`.trim();
		})
		.join(", ");
}

function renderBottomMeta(item: TimetableItem): ReactNode {
	if (item.name && item.location) {
		return (
			<>
				<p className="bottom left">{item.location}</p>
				<p className="bottom right">{shortenName(item.name)}</p>
			</>
		);
	}

	const text = [item.location, item.name ? shortenName(item.name) : undefined].filter(Boolean).join(item.w > 1 ? "   " : "  ");
	return <p className="bottom center">{text || "-"}</p>;
}

export function TimetableGrid({ items, highlighting }: { items: TimetableItem[]; highlighting: boolean }) {
	const timetableRef = useRef<HTMLDivElement | null>(null);
	const activeWeekday = highlighting ? getCurrentWeekday() : null;
	const firstXPos = new Array(5).fill(Infinity);
	const lastXPos = new Array(5).fill(0);

	for (const item of items) {
		firstXPos[item.y] = Math.min(firstXPos[item.y], item.x);
		lastXPos[item.y] = Math.max(lastXPos[item.y], item.x);
	}

	useLayoutEffect(() => {
		const container = timetableRef.current;
		if (!container) {
			return;
		}

		const fitText = () => fitTimetableText(container);

		fitText();

		if (document.fonts?.ready) {
			void document.fonts.ready.then(fitText);
		}

		const resizeObserver = new ResizeObserver(() => {
			fitText();
		});

		resizeObserver.observe(container);
		container.querySelectorAll<HTMLElement>(".item").forEach((itemElement) => {
			resizeObserver.observe(itemElement);
		});

		return () => {
			resizeObserver.disconnect();
		};
	}, [items, highlighting]);

	return (
		<div id="timetable" ref={timetableRef}>
			<div className="num" style={{ gridColumn: "2 / span 2" }}>1</div>
			<div className="num" style={{ gridColumn: "4 / span 2" }}>2</div>
			<div className="num s" style={{ gridColumn: "6" }}>Proaeg</div>
			<div className="num" style={{ gridColumn: "7 / span 2" }}>3</div>
			<div className="num s" style={{ gridColumn: "9" }}>Amps</div>
			<div className="num" style={{ gridColumn: "10 / span 2" }}>4</div>
			{WEEKDAYS.map((weekday, index) => (
				<div
					key={weekday}
					className={`wkd${activeWeekday !== null && activeWeekday !== index ? " unhilighted" : ""}`}
					style={{ gridRow: String(index + 2) }}
				>
					{weekday}
				</div>
			))}
			{items.map((item, index) => {
				const classes = [
					"item",
					item.isBreak ? "break" : "lesson",
					activeWeekday !== null && item.y !== activeWeekday ? "unhilighted" : "",
					firstXPos[item.y] === item.x ? "first" : "",
					lastXPos[item.y] === item.x ? "last" : "",
					item.w > 1 ? "wide" : ""
				].filter(Boolean).join(" ");
				const gridArea = item.w > 1
					? `${item.y + 2} / ${item.x + 2} / span 1 / span ${item.w}`
					: `${item.y + 2} / ${item.x + 2}`;

				return (
					<div key={`${item.title}-${item.y}-${item.x}-${index}`} className={classes} style={{ gridArea }}>
						<label>{item.title}</label>
						<time>{item.time}</time>
						{renderBottomMeta(item)}
					</div>
				);
			})}
		</div>
	);
}
