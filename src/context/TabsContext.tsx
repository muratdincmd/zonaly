import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import { TLDS_DEFAULT } from "../components/ExtensionPicker";
import type { DomainQuery, DomainResult } from "../types/domain";

// ── Tab accent colours (cycles for tabs 11-20) ────────────────────────────────
export const TAB_COLORS = [
  "#7C6FE0", // purple
  "#2DD4BF", // teal
  "#F59E0B", // amber
  "#F43F5E", // rose
  "#3B82F6", // blue
  "#22C55E", // green
  "#F97316", // orange
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#6366F1", // indigo
] as const;

export const MAX_TABS = 20;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TabState {
  id: string;
  title: string;           // display title; updated after a query runs
  inputText: string;
  selectedTlds: Set<string>;
  submittedQueries: DomainQuery[];
  results: Map<string, DomainResult>;
  isChecking: boolean;
  color: string;
}

export interface TabsState {
  tabs: TabState[];
  activeId: string;
  // monotonically increasing counter used to generate unique ids
  counter: number;
}

export type TabsAction =
  | { type: "ADD_TAB"; afterId?: string; copyFrom?: string }
  | { type: "CLOSE_TAB"; id: string }
  | { type: "CLOSE_OTHER_TABS"; id: string }
  | { type: "CLOSE_TABS_TO_RIGHT"; id: string }
  | { type: "ACTIVATE_TAB"; id: string }
  | { type: "UPDATE_INPUT"; id: string; value: string }
  | { type: "TOGGLE_TLD"; id: string; tld: string }
  | { type: "BULK_TOGGLE_TLD"; id: string; tlds: string[]; select: boolean }
  | { type: "SET_CHECKING"; id: string; value: boolean }
  | { type: "ADD_RESULT"; id: string; result: DomainResult }
  | { type: "CLEAR_RESULTS"; id: string }
  | { type: "SET_SUBMITTED"; id: string; queries: DomainQuery[] }
  | { type: "SET_TITLE"; id: string; title: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

export function makeTab(counter: number, overrides?: Partial<TabState>): TabState {
  return {
    id: `tab-${counter}`,
    title: "",                           // empty = show "New Search" placeholder
    inputText: "",
    selectedTlds: new Set(TLDS_DEFAULT),
    submittedQueries: [],
    results: new Map(),
    isChecking: false,
    color: TAB_COLORS[(counter - 1) % TAB_COLORS.length],
    ...overrides,
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function reducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "ADD_TAB": {
      if (state.tabs.length >= MAX_TABS) return state;
      const counter = state.counter + 1;
      const source = action.copyFrom
        ? state.tabs.find((t) => t.id === action.copyFrom)
        : undefined;
      const newTab = makeTab(counter, source
        ? {
            inputText: source.inputText,
            selectedTlds: new Set(source.selectedTlds),
            title: source.title,
          }
        : undefined);
      const afterIdx = action.afterId
        ? state.tabs.findIndex((t) => t.id === action.afterId)
        : state.tabs.length - 1;
      const tabs = [...state.tabs];
      tabs.splice(afterIdx + 1, 0, newTab);
      return { ...state, tabs, activeId: newTab.id, counter };
    }

    case "CLOSE_TAB": {
      if (state.tabs.length === 1) {
        // Replace with a fresh tab instead of going to zero
        const counter = state.counter + 1;
        const fresh = makeTab(counter);
        return { tabs: [fresh], activeId: fresh.id, counter };
      }
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      if (idx === -1) return state;
      const tabs = state.tabs.filter((t) => t.id !== action.id);
      const newActive =
        state.activeId === action.id
          ? (tabs[idx] ?? tabs[idx - 1]).id
          : state.activeId;
      return { ...state, tabs, activeId: newActive };
    }

    case "CLOSE_OTHER_TABS": {
      const keep = state.tabs.find((t) => t.id === action.id);
      if (!keep) return state;
      return { ...state, tabs: [keep], activeId: keep.id };
    }

    case "CLOSE_TABS_TO_RIGHT": {
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      if (idx === -1) return state;
      const tabs = state.tabs.slice(0, idx + 1);
      const newActive = tabs.find((t) => t.id === state.activeId)
        ? state.activeId
        : tabs[tabs.length - 1].id;
      return { ...state, tabs, activeId: newActive };
    }

    case "ACTIVATE_TAB":
      return { ...state, activeId: action.id };

    case "UPDATE_INPUT":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, inputText: action.value } : t
        ),
      };

    case "TOGGLE_TLD":
      return {
        ...state,
        tabs: state.tabs.map((t) => {
          if (t.id !== action.id) return t;
          const next = new Set(t.selectedTlds);
          if (next.has(action.tld)) next.delete(action.tld);
          else next.add(action.tld);
          return { ...t, selectedTlds: next };
        }),
      };

    case "BULK_TOGGLE_TLD":
      return {
        ...state,
        tabs: state.tabs.map((t) => {
          if (t.id !== action.id) return t;
          const next = new Set(t.selectedTlds);
          for (const tld of action.tlds) {
            if (action.select) next.add(tld);
            else next.delete(tld);
          }
          return { ...t, selectedTlds: next };
        }),
      };

    case "SET_CHECKING":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, isChecking: action.value } : t
        ),
      };

    case "ADD_RESULT":
      return {
        ...state,
        tabs: state.tabs.map((t) => {
          if (t.id !== action.id) return t;
          const results = new Map(t.results);
          const r = action.result;
          results.set(`${r.name}.${r.tld}`, r);
          return { ...t, results };
        }),
      };

    case "CLEAR_RESULTS":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, results: new Map() } : t
        ),
      };

    case "SET_SUBMITTED":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, submittedQueries: action.queries } : t
        ),
      };

    case "SET_TITLE":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, title: action.title } : t
        ),
      };

    default:
      return state;
  }
}

// ── Initial state ─────────────────────────────────────────────────────────────

function initialState(): TabsState {
  const first = makeTab(1);
  return { tabs: [first], activeId: first.id, counter: 1 };
}

// ── Context ───────────────────────────────────────────────────────────────────

interface TabsContextValue {
  tabs: TabState[];
  activeId: string;
  activeTab: TabState;
  dispatch: React.Dispatch<TabsAction>;
  // Convenience actions
  addTab: (afterId?: string) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  duplicateTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const activeTab = state.tabs.find((t) => t.id === state.activeId)!;

  const addTab = useCallback(
    (afterId?: string) =>
      dispatch({ type: "ADD_TAB", afterId: afterId ?? state.activeId }),
    [state.activeId]
  );
  const closeTab = useCallback(
    (id: string) => dispatch({ type: "CLOSE_TAB", id }),
    []
  );
  const activateTab = useCallback(
    (id: string) => dispatch({ type: "ACTIVATE_TAB", id }),
    []
  );
  const duplicateTab = useCallback(
    (id: string) => dispatch({ type: "ADD_TAB", afterId: id, copyFrom: id }),
    []
  );
  const closeOtherTabs = useCallback(
    (id: string) => dispatch({ type: "CLOSE_OTHER_TABS", id }),
    []
  );
  const closeTabsToRight = useCallback(
    (id: string) => dispatch({ type: "CLOSE_TABS_TO_RIGHT", id }),
    []
  );

  return (
    <TabsContext.Provider
      value={{
        tabs: state.tabs,
        activeId: state.activeId,
        activeTab,
        dispatch,
        addTab,
        closeTab,
        activateTab,
        duplicateTab,
        closeOtherTabs,
        closeTabsToRight,
      }}
    >
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useTabs must be used inside TabsProvider");
  return ctx;
}
