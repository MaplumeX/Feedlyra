import { describe, expect, it } from "vitest";
import { resolveAuthError } from "@/lib/auth-errors";

describe("resolveAuthError", () => {
  it("maps known backend detail strings to specific i18n keys", () => {
    expect(resolveAuthError(new Error("Invalid credentials"))).toBe("errors.invalidCredentials");
    expect(resolveAuthError(new Error("Email already registered"))).toBe(
      "errors.emailAlreadyRegistered",
    );
    expect(resolveAuthError(new Error("Username already taken"))).toBe(
      "errors.usernameAlreadyTaken",
    );
  });

  it("falls back to the generic key when detail is unknown", () => {
    // client.ts throws `new Error(error.detail ?? "Request failed")`; an unknown
    // backend string must not leak as a raw key.
    expect(resolveAuthError(new Error("Some new backend message"))).toBe("errors.unexpected");
  });

  it("falls back when the API client used its own placeholder detail", () => {
    // When backend detail is undefined, client.ts throws "Request failed".
    expect(resolveAuthError(new Error("Request failed"))).toBe("errors.unexpected");
  });

  it("falls back for non-Error throws (string, object, null, undefined)", () => {
    expect(resolveAuthError("Invalid credentials")).toBe("errors.unexpected");
    expect(resolveAuthError({ detail: "Invalid credentials" })).toBe("errors.unexpected");
    expect(resolveAuthError(null)).toBe("errors.unexpected");
    expect(resolveAuthError(undefined)).toBe("errors.unexpected");
  });

  it("falls back for an Error with an empty message", () => {
    expect(resolveAuthError(new Error(""))).toBe("errors.unexpected");
  });
});
