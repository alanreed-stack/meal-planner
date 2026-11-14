import { describe, expect, it } from "vitest";
import { applyRemote, dropChange, enqueue, flushQueue, parseQueue, pendingText, type Change } from "@/lib/offline-queue";

describe("enqueue", () => {
  it("keeps changes in order", () => {
    expect(enqueue(enqueue([], { id: "a", picked: true }), { id: "b", picked: true })).toEqual([
      { id: "a", picked: true },
      { id: "b", picked: true },
    ]);
  });
  it("lets the newest change for an item win", () => {
    let q = enqueue([], { id: "a", picked: true });
    q = enqueue(q, { id: "b", picked: true });
    q = enqueue(q, { id: "a", picked: false });
    expect(q).toEqual([
      { id: "b", picked: true },
      { id: "a", picked: false },
    ]);
  });
  it("can drop an item's waiting change", () => {
    expect(dropChange([{ id: "a", picked: true }, { id: "b", picked: true }], "a")).toEqual([{ id: "b", picked: true }]);
  });
});

describe("parseQueue", () => {
  it("reads a saved queue", () => {
    expect(parseQueue(JSON.stringify([{ id: "a", picked: true }]))).toEqual([{ id: "a", picked: true }]);
  });
  it("copes with nothing and with bad data", () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue("nope")).toEqual([]);
    expect(parseQueue('{"id":"a"}')).toEqual([]);
    expect(parseQueue(JSON.stringify([{ id: 1 }, { id: "b", picked: "yes" }, { id: "c", picked: false }]))).toEqual([
      { id: "c", picked: false },
    ]);
  });
});

describe("flushQueue", () => {
  const q: Change[] = [
    { id: "a", picked: true },
    { id: "b", picked: true },
    { id: "c", picked: false },
  ];
  it("sends everything in order when the connection is fine", async () => {
    const sent: string[] = [];
    const left = await flushQueue(q, async (c) => void sent.push(c.id));
    expect(sent).toEqual(["a", "b", "c"]);
    expect(left).toEqual([]);
  });
  it("stops at the first failure and keeps the rest, in order", async () => {
    const sent: string[] = [];
    const left = await flushQueue(q, async (c) => {
      if (c.id === "b") throw new Error("offline");
      sent.push(c.id);
    });
    expect(sent).toEqual(["a"]);
    expect(left.map((c) => c.id)).toEqual(["b", "c"]);
  });
  it("leaves an empty queue alone", async () => {
    expect(await flushQueue([], async () => {})).toEqual([]);
  });
});

describe("applyRemote (the other phone ticked something)", () => {
  it("shows the other phone's change", () => {
    expect(applyRemote({ a: false }, [], { id: "a", picked: true })).toEqual({ a: true });
  });
  it("keeps your own waiting change, which is newer", () => {
    const current = { a: false };
    expect(applyRemote(current, [{ id: "a", picked: false }], { id: "a", picked: true })).toBe(current);
  });
  it("still applies changes to other items", () => {
    expect(applyRemote({ a: false }, [{ id: "a", picked: false }], { id: "b", picked: true })).toEqual({ a: false, b: true });
  });
});

describe("pendingText", () => {
  it("says what is waiting", () => {
    expect(pendingText(3, false)).toBe("Offline, 3 changes waiting");
    expect(pendingText(1, false)).toBe("Offline, 1 change waiting");
    expect(pendingText(2, true)).toBe("2 changes waiting to save");
  });
  it("says nothing when all is well", () => {
    expect(pendingText(0, true)).toBeNull();
  });
  it("reminds you that you are offline even with nothing waiting", () => {
    expect(pendingText(0, false)).toBe("Offline. Ticks will save when you have signal.");
  });
});
