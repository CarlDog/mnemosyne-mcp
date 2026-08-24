// apiSecurity middleware -- mirrors http-transport.test.ts's harness
// style for the equivalent checks on the /mcp transport.

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterEach, describe, expect, test } from "vitest";
import { apiSecurity } from "../src/api-security.js";
import type { HttpConfig } from "../src/http-config.js";

type Harness = { url: string; dispose: () => Promise<void> };

const live: Harness[] = [];

async function start(
  opts: Partial<Pick<HttpConfig, "allowedHosts" | "authToken">>,
): Promise<Harness> {
  const app = express();
  app.use(
    apiSecurity({
      allowedHosts: opts.allowedHosts,
      authToken: opts.authToken,
    }),
  );
  app.get("/probe", (_req, res) => res.json({ ok: true }));

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;

  const harness: Harness = {
    url: `http://127.0.0.1:${port}`,
    dispose: () =>
      new Promise<void>((resolve) => server.close(() => resolve())),
  };
  live.push(harness);
  return harness;
}

afterEach(async () => {
  while (live.length) await live.pop()?.dispose();
});

describe("apiSecurity", () => {
  test("open (200) when neither allowedHosts nor authToken is set", async () => {
    const { url } = await start({});
    const res = await fetch(`${url}/probe`);
    expect(res.status).toBe(200);
  });

  test("403 when the Host header isn't in the allowlist", async () => {
    const { url } = await start({ allowedHosts: ["allowed.example"] });
    const res = await fetch(`${url}/probe`);
    expect(res.status).toBe(403);
  });

  test("200 when the Host header matches the allowlist", async () => {
    const { url } = await start({ allowedHosts: ["127.0.0.1"] });
    const res = await fetch(`${url}/probe`);
    expect(res.status).toBe(200);
  });

  test("401 with no Authorization header when authToken is set", async () => {
    const { url } = await start({ authToken: "correct-horse" });
    const res = await fetch(`${url}/probe`);
    expect(res.status).toBe(401);
  });

  test("401 with a wrong bearer token", async () => {
    const { url } = await start({ authToken: "correct-horse" });
    const res = await fetch(`${url}/probe`, {
      headers: { authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  test("200 with the correct bearer token", async () => {
    const { url } = await start({ authToken: "correct-horse" });
    const res = await fetch(`${url}/probe`, {
      headers: { authorization: "Bearer correct-horse" },
    });
    expect(res.status).toBe(200);
  });

  test("host check runs before auth: a disallowed host is 403, not 401, even with no token", async () => {
    const { url } = await start({
      allowedHosts: ["allowed.example"],
      authToken: "correct-horse",
    });
    const res = await fetch(`${url}/probe`, {
      headers: { authorization: "Bearer correct-horse" },
    });
    expect(res.status).toBe(403);
  });
});
