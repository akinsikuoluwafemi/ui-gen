import { test, expect, vi, afterEach } from "vitest";
import { SignJWT } from "jose";

const { mockCookieStore, mockSignJWTInstance } = vi.hoisted(() => {
  const mockSignJWTInstance = {
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-token-123"),
  };
  const mockCookieStore = {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  };
  return { mockSignJWTInstance, mockCookieStore };
});

vi.mock("server-only", () => ({}));

vi.mock("jose", () => ({
  SignJWT: vi.fn(() => mockSignJWTInstance),
  jwtVerify: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

import { createSession } from "../auth";

afterEach(() => {
  vi.clearAllMocks();
  mockSignJWTInstance.setProtectedHeader.mockReturnThis();
  mockSignJWTInstance.setExpirationTime.mockReturnThis();
  mockSignJWTInstance.setIssuedAt.mockReturnThis();
  mockSignJWTInstance.sign.mockResolvedValue("mock-token-123");
});

test("createSession: creates JWT with the correct userId and email payload", async () => {
  await createSession("user-123", "user@example.com");

  expect(SignJWT).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "user-123", email: "user@example.com" })
  );
});

test("createSession: signs JWT with HS256 algorithm", async () => {
  await createSession("user-123", "user@example.com");

  expect(mockSignJWTInstance.setProtectedHeader).toHaveBeenCalledWith({ alg: "HS256" });
});

test("createSession: sets JWT expiry to 7 days", async () => {
  await createSession("user-123", "user@example.com");

  expect(mockSignJWTInstance.setExpirationTime).toHaveBeenCalledWith("7d");
});

test("createSession: sets the auth-token cookie with the signed token", async () => {
  await createSession("user-123", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledWith(
    "auth-token",
    "mock-token-123",
    expect.any(Object)
  );
});

test("createSession: cookie is httpOnly with lax sameSite and root path", async () => {
  await createSession("user-123", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledWith(
    "auth-token",
    "mock-token-123",
    expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    })
  );
});

test("createSession: cookie expires approximately 7 days from now", async () => {
  const before = Date.now();
  await createSession("user-123", "user@example.com");
  const after = Date.now();

  const cookieOptions = mockCookieStore.set.mock.calls[0][2];
  const expiresAt = cookieOptions.expires as Date;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});
