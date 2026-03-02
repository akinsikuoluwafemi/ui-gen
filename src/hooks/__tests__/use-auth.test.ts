import { test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockPush } = vi.hoisted(() => {
  const mockPush = vi.fn();
  return { mockPush };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "new-proj-123" } as any);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

test("isLoading starts as false", () => {
  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);
});

test("hook exposes signIn, signUp, and isLoading", () => {
  const { result } = renderHook(() => useAuth());
  expect(typeof result.current.signIn).toBe("function");
  expect(typeof result.current.signUp).toBe("function");
  expect(typeof result.current.isLoading).toBe("boolean");
});

// ---------------------------------------------------------------------------
// signIn – calling the action
// ---------------------------------------------------------------------------

test("signIn: calls signInAction with the provided email and password", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(signInAction).toHaveBeenCalledWith("user@example.com", "secret123");
});

test("signIn: returns the result from signInAction", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });

  const { result } = renderHook(() => useAuth());
  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signIn("user@example.com", "secret123");
  });

  expect(returnValue).toEqual({ success: true });
});

test("signIn: returns error result when signInAction fails", async () => {
  vi.mocked(signInAction).mockResolvedValue({
    success: false,
    error: "Invalid credentials",
  });

  const { result } = renderHook(() => useAuth());
  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signIn("bad@example.com", "wrongpass");
  });

  expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
});

test("signIn: does not navigate when signInAction returns failure", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("bad@example.com", "wrongpass");
  });

  expect(mockPush).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// signIn – isLoading behaviour
// ---------------------------------------------------------------------------

test("signIn: sets isLoading to true while the action is in flight", async () => {
  let resolveSignIn!: (v: any) => void;
  vi.mocked(signInAction).mockReturnValue(
    new Promise((r) => {
      resolveSignIn = r;
    })
  );

  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);

  // Start signIn without awaiting – isLoading should flip to true
  act(() => {
    result.current.signIn("user@example.com", "secret123");
  });
  expect(result.current.isLoading).toBe(true);

  // Resolve so the hook can clean up
  await act(async () => {
    resolveSignIn({ success: false });
  });
  expect(result.current.isLoading).toBe(false);
});

test("signIn: resets isLoading to false after signInAction resolves", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: false });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(result.current.isLoading).toBe(false);
});

test("signIn: resets isLoading to false even when signInAction throws", async () => {
  vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

  const { result } = renderHook(() => useAuth());

  await expect(
    act(async () => {
      await result.current.signIn("user@example.com", "secret123");
    })
  ).rejects.toThrow("Network error");

  expect(result.current.isLoading).toBe(false);
});

// ---------------------------------------------------------------------------
// signIn – post sign-in routing: anon work present
// ---------------------------------------------------------------------------

test("signIn success: creates project from anon work when messages exist", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  const anonWork = {
    messages: [{ role: "user", content: "Make a button" }],
    fileSystemData: { "/App.jsx": "export default () => <button />" },
  };
  vi.mocked(getAnonWorkData).mockReturnValue(anonWork);
  vi.mocked(createProject).mockResolvedValue({ id: "anon-proj-abc" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: anonWork.messages,
      data: anonWork.fileSystemData,
    })
  );
});

test("signIn success: project name contains 'Design from' when saving anon work", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: [{ role: "user", content: "test" }],
    fileSystemData: {},
  });
  vi.mocked(createProject).mockResolvedValue({ id: "anon-proj" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  const name = vi.mocked(createProject).mock.calls[0][0].name;
  expect(name).toMatch(/^Design from /);
});

test("signIn success: clears anon work after saving it", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: [{ role: "user", content: "test" }],
    fileSystemData: {},
  });
  vi.mocked(createProject).mockResolvedValue({ id: "anon-proj" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(clearAnonWork).toHaveBeenCalled();
});

test("signIn success: navigates to saved anon project", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: [{ role: "user", content: "test" }],
    fileSystemData: {},
  });
  vi.mocked(createProject).mockResolvedValue({ id: "anon-proj-xyz" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(mockPush).toHaveBeenCalledWith("/anon-proj-xyz");
});

test("signIn success: skips getProjects when anon work has messages", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({
    messages: [{ role: "user", content: "test" }],
    fileSystemData: {},
  });
  vi.mocked(createProject).mockResolvedValue({ id: "anon-proj" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(getProjects).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// signIn – post sign-in routing: anon work present but empty messages
// ---------------------------------------------------------------------------

test("signIn success: falls through when anon messages array is empty", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });
  vi.mocked(getProjects).mockResolvedValue([{ id: "user-proj" } as any]);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(clearAnonWork).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/user-proj");
});

// ---------------------------------------------------------------------------
// signIn – post sign-in routing: existing projects
// ---------------------------------------------------------------------------

test("signIn success: navigates to first existing project", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getProjects).mockResolvedValue([
    { id: "proj-1" } as any,
    { id: "proj-2" } as any,
  ]);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(mockPush).toHaveBeenCalledWith("/proj-1");
});

test("signIn success: does not call createProject when existing projects are found", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" } as any]);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(createProject).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// signIn – post sign-in routing: no anon work, no existing projects
// ---------------------------------------------------------------------------

test("signIn success: creates new project when no anon work and no existing projects", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "fresh-proj" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: [], data: {} })
  );
});

test("signIn success: new project name is a non-empty string", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "fresh-proj" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  const name = vi.mocked(createProject).mock.calls[0][0].name;
  expect(typeof name).toBe("string");
  expect(name.length).toBeGreaterThan(0);
});

test("signIn success: navigates to newly created project", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: true });
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "fresh-proj-999" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signIn("user@example.com", "secret123");
  });

  expect(mockPush).toHaveBeenCalledWith("/fresh-proj-999");
});

// ---------------------------------------------------------------------------
// signUp – calling the action
// ---------------------------------------------------------------------------

test("signUp: calls signUpAction with the provided email and password", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("new@example.com", "password123");
  });

  expect(signUpAction).toHaveBeenCalledWith("new@example.com", "password123");
});

test("signUp: returns the result from signUpAction", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });

  const { result } = renderHook(() => useAuth());
  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signUp("new@example.com", "password123");
  });

  expect(returnValue).toEqual({ success: true });
});

test("signUp: returns error result when signUpAction fails", async () => {
  vi.mocked(signUpAction).mockResolvedValue({
    success: false,
    error: "Email already registered",
  });

  const { result } = renderHook(() => useAuth());
  let returnValue: any;
  await act(async () => {
    returnValue = await result.current.signUp("taken@example.com", "password123");
  });

  expect(returnValue).toEqual({ success: false, error: "Email already registered" });
});

test("signUp: does not navigate when signUpAction returns failure", async () => {
  vi.mocked(signUpAction).mockResolvedValue({
    success: false,
    error: "Email already registered",
  });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("taken@example.com", "password123");
  });

  expect(mockPush).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// signUp – isLoading behaviour
// ---------------------------------------------------------------------------

test("signUp: sets isLoading to true while the action is in flight", async () => {
  let resolveSignUp!: (v: any) => void;
  vi.mocked(signUpAction).mockReturnValue(
    new Promise((r) => {
      resolveSignUp = r;
    })
  );

  const { result } = renderHook(() => useAuth());
  expect(result.current.isLoading).toBe(false);

  act(() => {
    result.current.signUp("new@example.com", "password123");
  });
  expect(result.current.isLoading).toBe(true);

  await act(async () => {
    resolveSignUp({ success: false });
  });
  expect(result.current.isLoading).toBe(false);
});

test("signUp: resets isLoading to false after signUpAction resolves", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: false });

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("new@example.com", "password123");
  });

  expect(result.current.isLoading).toBe(false);
});

test("signUp: resets isLoading to false even when signUpAction throws", async () => {
  vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

  const { result } = renderHook(() => useAuth());

  await expect(
    act(async () => {
      await result.current.signUp("new@example.com", "password123");
    })
  ).rejects.toThrow("Server error");

  expect(result.current.isLoading).toBe(false);
});

// ---------------------------------------------------------------------------
// signUp – post sign-up routing mirrors signIn routing
// ---------------------------------------------------------------------------

test("signUp success: saves anon work as project when messages exist", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });
  const anonWork = {
    messages: [{ role: "user", content: "Make a card" }],
    fileSystemData: { "/App.jsx": "export default () => <div />" },
  };
  vi.mocked(getAnonWorkData).mockReturnValue(anonWork);
  vi.mocked(createProject).mockResolvedValue({ id: "signup-anon-proj" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("new@example.com", "password123");
  });

  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({
      messages: anonWork.messages,
      data: anonWork.fileSystemData,
    })
  );
  expect(clearAnonWork).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/signup-anon-proj");
});

test("signUp success: navigates to first existing project when no anon work", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });
  vi.mocked(getProjects).mockResolvedValue([{ id: "existing-proj" } as any]);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("new@example.com", "password123");
  });

  expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  expect(createProject).not.toHaveBeenCalled();
});

test("signUp success: creates and navigates to new project when no anon work and no existing projects", async () => {
  vi.mocked(signUpAction).mockResolvedValue({ success: true });
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "brand-new-proj" } as any);

  const { result } = renderHook(() => useAuth());
  await act(async () => {
    await result.current.signUp("new@example.com", "password123");
  });

  expect(createProject).toHaveBeenCalledWith(
    expect.objectContaining({ messages: [], data: {} })
  );
  expect(mockPush).toHaveBeenCalledWith("/brand-new-proj");
});

// ---------------------------------------------------------------------------
// Concurrent calls
// ---------------------------------------------------------------------------

test("isLoading returns to false after concurrent signIn calls both settle", async () => {
  vi.mocked(signInAction).mockResolvedValue({ success: false });

  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await Promise.all([
      result.current.signIn("a@example.com", "pass1"),
      result.current.signIn("b@example.com", "pass2"),
    ]);
  });

  expect(result.current.isLoading).toBe(false);
});
