import assert from "assert";
import { ClockTimer } from "@colyseus/timer";
import { scheduleTimer, TimerRoom } from "../src/timer.js";
import { cleanup, getTestServer } from "./testServer.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function roomWithClock(): TimerRoom {
  return { clock: new ClockTimer(true) };
}

describe("scheduleTimer", () => {
  it("fires once after the delay", async () => {
    const room = roomWithClock();
    let fires = 0;

    scheduleTimer(room, 30, () => fires++);

    await sleep(150);
    assert.strictEqual(fires, 1);
  });

  it("cancel() prevents the callback from firing", async () => {
    const room = roomWithClock();
    let fired = false;

    const handle = scheduleTimer(room, 30, () => { fired = true; });
    handle.cancel();

    await sleep(150);
    assert.strictEqual(fired, false);
  });

  it("does not fire after the room clock is cleared (room dispose)", async () => {
    const clock = new ClockTimer(true);
    const room: TimerRoom = { clock };
    let fired = false;

    scheduleTimer(room, 30, () => { fired = true; });
    clock.clear();

    await sleep(150);
    assert.strictEqual(fired, false);
  });

  it("cancel() before the callback has run keeps it cancelled", async () => {
    const room = roomWithClock();
    let fired = 0;

    const handle = scheduleTimer(room, 30, () => fired++);
    await sleep(60);
    handle.cancel();
    await sleep(200);

    assert.strictEqual(fired, 1);
  });

  it("works against a real Colyseus Room clock", async () => {
    await cleanup();
    const colyseus = await getTestServer();
    const room = await colyseus.createRoom("trivia", {});
    let fired = false;

    scheduleTimer(room, 30, () => { fired = true; });

    await sleep(250);
    assert.strictEqual(fired, true);
    await room.waitForNextPatch();
  });
});