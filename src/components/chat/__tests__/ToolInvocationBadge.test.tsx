import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge, getLabel } from "../ToolInvocationBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// getLabel — pure function tests (no rendering required)
// ---------------------------------------------------------------------------

test("getLabel: str_replace_editor create returns 'Creating {filename}'", () => {
  expect(getLabel("str_replace_editor", { command: "create", path: "/components/Button.tsx" })).toBe(
    "Creating Button.tsx"
  );
});

test("getLabel: str_replace_editor str_replace returns 'Editing {filename}'", () => {
  expect(getLabel("str_replace_editor", { command: "str_replace", path: "/App.jsx" })).toBe(
    "Editing App.jsx"
  );
});

test("getLabel: str_replace_editor insert returns 'Editing {filename}'", () => {
  expect(getLabel("str_replace_editor", { command: "insert", path: "/App.jsx" })).toBe(
    "Editing App.jsx"
  );
});

test("getLabel: str_replace_editor view returns 'Reading {filename}'", () => {
  expect(getLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe(
    "Reading App.jsx"
  );
});

test("getLabel: str_replace_editor undo_edit returns 'Reverting {filename}'", () => {
  expect(getLabel("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })).toBe(
    "Reverting App.jsx"
  );
});

test("getLabel: file_manager delete returns 'Deleting {filename}'", () => {
  expect(getLabel("file_manager", { command: "delete", path: "/components/old.tsx" })).toBe(
    "Deleting old.tsx"
  );
});

test("getLabel: file_manager rename returns 'Renaming {filename} to {newFilename}'", () => {
  expect(
    getLabel("file_manager", {
      command: "rename",
      path: "/components/old.tsx",
      new_path: "/components/new.tsx",
    })
  ).toBe("Renaming old.tsx to new.tsx");
});

test("getLabel: file_manager rename without new_path omits destination", () => {
  expect(getLabel("file_manager", { command: "rename", path: "/components/old.tsx" })).toBe(
    "Renaming old.tsx"
  );
});

test("getLabel: missing path falls back to generic label", () => {
  expect(getLabel("str_replace_editor", { command: "create" })).toBe("Creating file");
});

test("getLabel: unknown tool name falls back to raw toolName", () => {
  expect(getLabel("some_future_tool", { command: "do_thing" })).toBe("some_future_tool");
});

// ---------------------------------------------------------------------------
// ToolInvocationBadge — component render tests
// ---------------------------------------------------------------------------

test("ToolInvocationBadge shows loading indicator when state is 'call'", () => {
  const invocation: ToolInvocation = {
    state: "call",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "/App.jsx" },
  };

  render(<ToolInvocationBadge toolInvocation={invocation} />);

  expect(screen.getByTestId("tool-loading-indicator")).toBeDefined();
  expect(screen.queryByTestId("tool-done-indicator")).toBeNull();
});

test("ToolInvocationBadge shows done indicator when state is 'result' with result", () => {
  const invocation: ToolInvocation = {
    state: "result",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "/App.jsx" },
    result: "File created successfully",
  };

  render(<ToolInvocationBadge toolInvocation={invocation} />);

  expect(screen.getByTestId("tool-done-indicator")).toBeDefined();
  expect(screen.queryByTestId("tool-loading-indicator")).toBeNull();
});

test("ToolInvocationBadge renders the correct friendly label", () => {
  const invocation: ToolInvocation = {
    state: "call",
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "/components/Button.tsx" },
  };

  render(<ToolInvocationBadge toolInvocation={invocation} />);

  expect(screen.getByText("Creating Button.tsx")).toBeDefined();
});
