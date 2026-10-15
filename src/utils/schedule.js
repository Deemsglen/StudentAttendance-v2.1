export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const dayAliases = {
  sun: 0,
  sunday: 0,
  linggo: 0,
  minggu: 0,
  mon: 1,
  monday: 1,
  lunes: 1,
  senin: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  martes: 2,
  selasa: 2,
  wed: 3,
  wednesday: 3,
  miyerkules: 3,
  rabu: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  huwebes: 4,
  kamis: 4,
  fri: 5,
  friday: 5,
  biyernes: 5,
  jumat: 5,
  sat: 6,
  saturday: 6,
  sabado: 6,
  sabtu: 6,
};
export function validateSubject(row) {
  const subject = String(row.subject || "").trim(),
    day = Number(row.day),
    time = String(row.time || ""),
    end = String(row.end || "");
  if (!subject || subject.length > 120)
    throw new Error("Enter a subject name (up to 120 characters).");
  if (!Number.isInteger(day) || day < 0 || day > 6)
    throw new Error("Choose a valid class day.");
  const valid = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (!valid(time) || !valid(end) || time >= end)
    throw new Error(
      `${subject}: end time must be after start time on the same day.`,
    );
  return {
    ...(row.id ? { id: row.id } : {}),
    subject,
    day,
    time,
    end,
    teacher: String(row.teacher || "")
      .trim()
      .slice(0, 120),
    room: String(row.room || "")
      .trim()
      .slice(0, 100),
  };
}
function time24(hour, minute, meridiem) {
  let h = Number(hour),
    m = Number(minute || 0);
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (meridiem[0].toLowerCase() === "p" ? 12 : 0);
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function parseScheduleText(text) {
  const rows = [],
    unresolved = [];
  let activeDays = [];
  for (const original of String(text).split(/\n/)) {
    const line = original.trim();
    if (!line) continue;
    const tokens = line.toLowerCase().match(/[a-z]+/g) || [];
    const found = [
      ...new Set(
        tokens.filter((t) => t in dayAliases).map((t) => dayAliases[t]),
      ),
    ];
    const range = line.match(
      /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/i,
    );
    if (!range) {
      // Several day names without a time can be table column headers, not a
      // repeating class. Do not assign later rows to every column by guessing.
      activeDays = found.length === 1 ? found : [];
      if (found.length !== 1) unresolved.push(line);
      continue;
    }
    const allRanges =
      line.match(
        /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/gi,
      ) || [];
    if (allRanges.length !== 1) {
      activeDays = [];
      unresolved.push(line);
      continue;
    }
    if (found.length) activeDays = found;
    // Do not infer missing meridiem: ambiguous ranges must be checked manually.
    const explicit =
      (!range[3] && !range[6] && !!range[2] && !!range[5]) ||
      (!!range[3] && !!range[6]);
    const start = explicit ? time24(range[1], range[2], range[3]) : null,
      end = explicit ? time24(range[4], range[5], range[6]) : null;
    const after = line
      .slice(range.index + range[0].length)
      .replace(/^[\s|:;,-]+/, "");
    let before = line
      .slice(0, range.index)
      .replace(
        /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thurs?|fri|sat|lunes|martes|miyerkules|huwebes|biyernes|sabado|linggo|senin|selasa|rabu|kamis|jumat|sabtu|minggu)\b/gi,
        "",
      )
      .replace(/^[\s|:;,-]+|[\s|:;,-]+$/g, "");
    const title = (after || before).replace(/\s+/g, " ").trim();
    if (!start || !end || start >= end || !title || !activeDays.length) {
      unresolved.push(line);
      continue;
    }
    for (const day of activeDays)
      rows.push({
        subject: title.slice(0, 120),
        day,
        time: start,
        end,
        teacher: "",
        room: "",
      });
  }
  return { rows, unresolved };
}
