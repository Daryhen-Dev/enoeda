import { describe, it, expect } from "vitest";

describe("lib/supabase foundation", () => {
  it("database.types exports Database interface", async () => {
    const mod = await import("./database.types");
    expect(mod).toBeDefined();
  });

  it("client module exports createClient function", async () => {
    const mod = await import("./client");
    expect(mod.createClient).toBeTypeOf("function");
  });

  it("server module exports createClient function", async () => {
    const mod = await import("./server");
    expect(mod.createClient).toBeTypeOf("function");
  });

  it("middleware module exports updateSession function", async () => {
    const mod = await import("./middleware");
    expect(mod.updateSession).toBeTypeOf("function");
  });
});
