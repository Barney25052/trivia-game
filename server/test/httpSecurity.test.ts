import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { checkBasicAuth } from "../src/httpSecurity.js";
import { getTestServer } from "./testServer.js";

describe("checkBasicAuth", () => {
  const basicHeader = (user: string, pass: string) =>
    `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

  it("accepts the exact configured username and password", () => {
    assert.strictEqual(checkBasicAuth(basicHeader("admin", "s3cret"), "admin", "s3cret"), true);
  });

  it("rejects a wrong password", () => {
    assert.strictEqual(checkBasicAuth(basicHeader("admin", "wrong"), "admin", "s3cret"), false);
  });

  it("rejects a wrong username", () => {
    assert.strictEqual(checkBasicAuth(basicHeader("nope", "s3cret"), "admin", "s3cret"), false);
  });

  it("rejects a missing Authorization header", () => {
    assert.strictEqual(checkBasicAuth(undefined, "admin", "s3cret"), false);
  });

  it("rejects a non-Basic scheme", () => {
    assert.strictEqual(checkBasicAuth("Bearer sometoken", "admin", "s3cret"), false);
  });

  it("rejects malformed base64", () => {
    assert.strictEqual(checkBasicAuth("Basic ###not-base64###", "admin", "s3cret"), false);
  });

  it("rejects a decoded value with no ':' separator", () => {
    const header = `Basic ${Buffer.from("adminonly").toString("base64")}`;
    assert.strictEqual(checkBasicAuth(header, "admin", "s3cret"), false);
  });

  it("is case-sensitive", () => {
    assert.strictEqual(checkBasicAuth(basicHeader("Admin", "s3cret"), "admin", "s3cret"), false);
  });

  it("rejects an empty password against a non-empty expected password", () => {
    const header = `Basic ${Buffer.from("admin:").toString("base64")}`;
    assert.strictEqual(checkBasicAuth(header, "admin", "s3cret"), false);
  });
});

describe("GET /monitor (production auth gate, ticket 131)", () => {
  let server: ColyseusTestServer<typeof appConfig>;
  let savedEnv: Record<string, string | undefined>;

  before(async () => {
    server = await getTestServer();
  });

  beforeEach(() => {
    savedEnv = {
      NODE_ENV: process.env.NODE_ENV,
      MONITOR_USER: process.env.MONITOR_USER,
      MONITOR_PASS: process.env.MONITOR_PASS
    };
  });

  afterEach(() => {
    for (const key of Object.keys(savedEnv)) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("dev (NODE_ENV unset): renders directly, no auth prompt", async () => {
    delete process.env.NODE_ENV;
    const res = await server.http.get("/monitor");
    assert.strictEqual(res.statusCode, 200);
  });

  it("production without MONITOR_USER/MONITOR_PASS configured: fails closed with 503", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.MONITOR_USER;
    delete process.env.MONITOR_PASS;
    await assert.rejects(server.http.get("/monitor"), (err: any) => {
      assert.strictEqual(err.statusCode, 503);
      return true;
    });
  });

  it("production with credentials configured: 401 without an Authorization header", async () => {
    process.env.NODE_ENV = "production";
    process.env.MONITOR_USER = "admin";
    process.env.MONITOR_PASS = "s3cret";
    await assert.rejects(server.http.get("/monitor"), (err: any) => {
      assert.strictEqual(err.statusCode, 401);
      assert.ok(err.headers["www-authenticate"], "must challenge with WWW-Authenticate");
      return true;
    });
  });

  it("production with credentials configured: 401 with wrong credentials", async () => {
    process.env.NODE_ENV = "production";
    process.env.MONITOR_USER = "admin";
    process.env.MONITOR_PASS = "s3cret";
    const badHeader = `Basic ${Buffer.from("admin:wrong").toString("base64")}`;
    await assert.rejects(
      server.http.get("/monitor", { headers: { authorization: badHeader } }),
      (err: any) => {
        assert.strictEqual(err.statusCode, 401);
        return true;
      }
    );
  });

  it("production with correct credentials: 200, panel renders", async () => {
    process.env.NODE_ENV = "production";
    process.env.MONITOR_USER = "admin";
    process.env.MONITOR_PASS = "s3cret";
    const goodHeader = `Basic ${Buffer.from("admin:s3cret").toString("base64")}`;
    const res = await server.http.get("/monitor", { headers: { authorization: goodHeader } });
    assert.strictEqual(res.statusCode, 200);
  });
});

describe("POST /api/questions (removed, ticket 168)", () => {
  let server: ColyseusTestServer<typeof appConfig>;

  before(async () => {
    server = await getTestServer();
  });

  it("no longer exists: a well-formed new question is not accepted", async () => {
    await assert.rejects(
      server.http.post("/api/questions", { body: { question: "Q?", answer: "A" } }),
      (err: any) => {
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );
  });
});
