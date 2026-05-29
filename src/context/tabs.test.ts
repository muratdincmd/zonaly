import { describe, it, expect } from "vitest";
import { reducer, makeTab, MAX_TABS, TAB_COLORS } from "./TabsContext";
import type { TabsState } from "./TabsContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides?: Partial<TabsState>): TabsState {
  const first = makeTab(1);
  return {
    tabs: [first],
    activeId: first.id,
    counter: 1,
    ...overrides,
  };
}

function stateWithTabs(n: number): TabsState {
  const tabs = Array.from({ length: n }, (_, i) => makeTab(i + 1));
  return { tabs, activeId: tabs[0].id, counter: n };
}

// ── makeTab ───────────────────────────────────────────────────────────────────

describe("makeTab", () => {
  it("assigns id based on counter", () => {
    expect(makeTab(1).id).toBe("tab-1");
    expect(makeTab(7).id).toBe("tab-7");
  });

  it("cycles accent colours", () => {
    expect(makeTab(1).color).toBe(TAB_COLORS[0]);
    expect(makeTab(TAB_COLORS.length + 1).color).toBe(TAB_COLORS[0]);
  });

  it("starts with empty title and inputText", () => {
    const tab = makeTab(1);
    expect(tab.title).toBe("");
    expect(tab.inputText).toBe("");
  });

  it("applies overrides", () => {
    const tab = makeTab(1, { title: "hello", inputText: "test" });
    expect(tab.title).toBe("hello");
    expect(tab.inputText).toBe("test");
  });
});

// ── ADD_TAB ───────────────────────────────────────────────────────────────────

describe("ADD_TAB", () => {
  it("adds a new tab and activates it", () => {
    const s = makeState();
    const next = reducer(s, { type: "ADD_TAB" });
    expect(next.tabs).toHaveLength(2);
    expect(next.activeId).toBe(next.tabs[1].id);
  });

  it("inserts after the specified afterId", () => {
    const s = stateWithTabs(3);
    const afterId = s.tabs[0].id;
    const next = reducer(s, { type: "ADD_TAB", afterId });
    expect(next.tabs[1].id).not.toBe(s.tabs[1].id); // new tab is at index 1
    expect(next.tabs).toHaveLength(4);
  });

  it("does not exceed MAX_TABS", () => {
    const s = stateWithTabs(MAX_TABS);
    const next = reducer(s, { type: "ADD_TAB" });
    expect(next.tabs).toHaveLength(MAX_TABS);
  });

  it("copies input and title when copyFrom is set", () => {
    const s = makeState();
    const src = s.tabs[0];
    // mutate source in state
    const withInput = reducer(s, { type: "UPDATE_INPUT", id: src.id, value: "hello" });
    const withTitle = reducer(withInput, { type: "SET_TITLE", id: src.id, title: "my query" });

    const next = reducer(withTitle, { type: "ADD_TAB", copyFrom: src.id });
    const newTab = next.tabs[next.tabs.length - 1];
    expect(newTab.inputText).toBe("hello");
    expect(newTab.title).toBe("my query");
  });

  it("does NOT copy results when duplicating", () => {
    const s = makeState();
    const next = reducer(s, { type: "ADD_TAB", copyFrom: s.tabs[0].id });
    const newTab = next.tabs[next.tabs.length - 1];
    expect(newTab.results.size).toBe(0);
    expect(newTab.submittedQueries).toHaveLength(0);
  });
});

// ── CLOSE_TAB ─────────────────────────────────────────────────────────────────

describe("CLOSE_TAB", () => {
  it("removes the specified tab", () => {
    const s = stateWithTabs(3);
    const idToClose = s.tabs[1].id;
    const next = reducer(s, { type: "CLOSE_TAB", id: idToClose });
    expect(next.tabs).toHaveLength(2);
    expect(next.tabs.find((t) => t.id === idToClose)).toBeUndefined();
  });

  it("activates the tab to the right when closing the active tab", () => {
    const s = stateWithTabs(3);
    // activate middle tab then close it
    const withActive = reducer(s, { type: "ACTIVATE_TAB", id: s.tabs[1].id });
    const next = reducer(withActive, { type: "CLOSE_TAB", id: s.tabs[1].id });
    // tab at index 1 (was index 2) should now be active
    expect(next.activeId).toBe(s.tabs[2].id);
  });

  it("activates the tab to the left when closing the last tab", () => {
    const s = stateWithTabs(3);
    const lastId = s.tabs[2].id;
    const withActive = reducer(s, { type: "ACTIVATE_TAB", id: lastId });
    const next = reducer(withActive, { type: "CLOSE_TAB", id: lastId });
    expect(next.activeId).toBe(s.tabs[1].id);
  });

  it("creates a fresh tab when closing the only tab (never zero tabs)", () => {
    const s = makeState();
    const only = s.tabs[0].id;
    const next = reducer(s, { type: "CLOSE_TAB", id: only });
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0].id).not.toBe(only);
    expect(next.tabs[0].inputText).toBe("");
  });

  it("does not change active tab when closing an inactive tab", () => {
    const s = stateWithTabs(3);
    const inactiveId = s.tabs[2].id;
    const next = reducer(s, { type: "CLOSE_TAB", id: inactiveId });
    expect(next.activeId).toBe(s.activeId);
  });
});

// ── CLOSE_OTHER_TABS ──────────────────────────────────────────────────────────

describe("CLOSE_OTHER_TABS", () => {
  it("keeps only the specified tab", () => {
    const s = stateWithTabs(5);
    const keepId = s.tabs[2].id;
    const next = reducer(s, { type: "CLOSE_OTHER_TABS", id: keepId });
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0].id).toBe(keepId);
    expect(next.activeId).toBe(keepId);
  });
});

// ── CLOSE_TABS_TO_RIGHT ───────────────────────────────────────────────────────

describe("CLOSE_TABS_TO_RIGHT", () => {
  it("removes all tabs after the specified one", () => {
    const s = stateWithTabs(5);
    const pivotId = s.tabs[1].id;
    const next = reducer(s, { type: "CLOSE_TABS_TO_RIGHT", id: pivotId });
    expect(next.tabs).toHaveLength(2);
    expect(next.tabs.map((t) => t.id)).toEqual([s.tabs[0].id, s.tabs[1].id]);
  });

  it("falls back active tab to last surviving if current was removed", () => {
    const s = stateWithTabs(5);
    // activate last tab, then close tabs to the right of tab[1]
    const withActive = reducer(s, { type: "ACTIVATE_TAB", id: s.tabs[4].id });
    const next = reducer(withActive, { type: "CLOSE_TABS_TO_RIGHT", id: s.tabs[1].id });
    expect(next.activeId).toBe(s.tabs[1].id);
  });
});

// ── ACTIVATE_TAB ─────────────────────────────────────────────────────────────

describe("ACTIVATE_TAB", () => {
  it("changes the active tab", () => {
    const s = stateWithTabs(3);
    const next = reducer(s, { type: "ACTIVATE_TAB", id: s.tabs[2].id });
    expect(next.activeId).toBe(s.tabs[2].id);
    expect(next.tabs).toHaveLength(3); // tabs unchanged
  });
});

// ── UPDATE_INPUT ──────────────────────────────────────────────────────────────

describe("UPDATE_INPUT", () => {
  it("updates inputText only for the targeted tab", () => {
    const s = stateWithTabs(2);
    const next = reducer(s, { type: "UPDATE_INPUT", id: s.tabs[0].id, value: "hello" });
    expect(next.tabs[0].inputText).toBe("hello");
    expect(next.tabs[1].inputText).toBe("");
  });
});

// ── TOGGLE_TLD ────────────────────────────────────────────────────────────────

describe("TOGGLE_TLD", () => {
  it("adds a TLD that was not selected", () => {
    const s = makeState();
    const tab = s.tabs[0];
    const tld = "xyz";
    const was = tab.selectedTlds.has(tld);
    const next = reducer(s, { type: "TOGGLE_TLD", id: tab.id, tld });
    expect(next.tabs[0].selectedTlds.has(tld)).toBe(!was);
  });

  it("removes a TLD that was selected", () => {
    const s = makeState();
    const tab = s.tabs[0];
    // pick any TLD that's in the default set
    const tld = [...tab.selectedTlds][0];
    const next = reducer(s, { type: "TOGGLE_TLD", id: tab.id, tld });
    expect(next.tabs[0].selectedTlds.has(tld)).toBe(false);
  });

  it("does not affect other tabs", () => {
    const s = stateWithTabs(2);
    const before = new Set(s.tabs[1].selectedTlds);
    const next = reducer(s, { type: "TOGGLE_TLD", id: s.tabs[0].id, tld: "com" });
    expect(next.tabs[1].selectedTlds).toEqual(before);
  });
});

// ── SET_TITLE ─────────────────────────────────────────────────────────────────

describe("SET_TITLE", () => {
  it("updates the title of the targeted tab", () => {
    const s = makeState();
    const next = reducer(s, { type: "SET_TITLE", id: s.tabs[0].id, title: "google, apple" });
    expect(next.tabs[0].title).toBe("google, apple");
  });
});
