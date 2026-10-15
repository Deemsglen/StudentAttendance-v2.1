import test from "node:test";
import assert from "node:assert/strict";
import { parseScheduleText, validateSubject } from "../src/utils/schedule.js";
import { passwordStrength } from "../src/utils/password.js";
test("parses day, 24h time and subject", () => {
  assert.deepEqual(
    parseScheduleText("Monday 09:00 - 10:30 Web Development").rows,
    [
      {
        subject: "Web Development",
        day: 1,
        time: "09:00",
        end: "10:30",
        teacher: "",
        room: "",
      },
    ],
  );
});
test("supports multi-day and explicit AM PM ranges", () => {
  const { rows } = parseScheduleText(
    "Tuesday Thursday 1:00 PM - 2:30 PM Database Systems",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].time, "13:00");
  assert.equal(rows[1].day, 4);
});
test("day heading applies to following lines; Tagalog day works", () => {
  const { rows } = parseScheduleText("Lunes\n08:00 - 09:30 Mathematics");
  assert.equal(rows[0].day, 1);
});
test("ambiguous times, missing days, backwards times never guessed", () => {
  for (const text of [
    "Monday 9 - 10 Mathematics",
    "Monday 9:00 - 10:00 AM Math",
    "09:00 - 10:00 Math",
    "Monday 14:00 - 09:00 Math",
  ])
    assert.equal(parseScheduleText(text).rows.length, 0);
});
test("subject validation rejects missing names and invalid ranges", () => {
  assert.throws(() =>
    validateSubject({ subject: "", day: 1, time: "09:00", end: "10:00" }),
  );
  assert.throws(() =>
    validateSubject({ subject: "Math", day: 9, time: "09:00", end: "10:00" }),
  );
  assert.throws(() =>
    validateSubject({ subject: "Math", day: 1, time: "24:00", end: "25:00" }),
  );
  assert.throws(() =>
    validateSubject({ subject: "Math", day: 1, time: "11:00", end: "10:00" }),
  );
});
test("password strength detects common/short and complex passwords", () => {
  assert.equal(passwordStrength("").score, 0);
  assert.ok(passwordStrength("password123!").score <= 1);
  assert.equal(passwordStrength("Cloud-Wave-42!June").label, "Strong");
});

test("ambiguous column headings and multiple time ranges are not assigned by guessing", () => {
  assert.equal(
    parseScheduleText("Monday Tuesday Wednesday\n09:00 - 10:00 Mathematics")
      .rows.length,
    0,
  );
  assert.equal(
    parseScheduleText("Monday 09:00 - 10:00 Math Tuesday 11:00 - 12:00 Science")
      .rows.length,
    0,
  );
});
