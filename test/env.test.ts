import { describe, expect, it } from "vitest";

import { type Env, getAdminId } from "../src/env";

function envWith(vars: Partial<Env>): Env {
  return { ALLOWED_USER_IDS: "", USER_NAMES: "", ...vars } as Env;
}

describe("getAdminId", () => {
  it("defaults to the first allowed user id", () => {
    expect(getAdminId(envWith({ ALLOWED_USER_IDS: "111, 222" }))).toBe(111);
  });

  it("prefers an explicit ADMIN_USER_ID", () => {
    expect(getAdminId(envWith({ ALLOWED_USER_IDS: "111,222", ADMIN_USER_ID: "222" }))).toBe(222);
  });

  it("is null when nothing is configured", () => {
    expect(getAdminId(envWith({}))).toBeNull();
  });
});
