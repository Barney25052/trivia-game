import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { checkBasicAuth, resolveAllowedOrigin } from "../src/httpSecurity.js";
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

describe("resolveAllowedOrigin", () => {
  it("returns '*' outside production regardless of CLIENT_ORIGIN", () => {
    assert.strictEqual(resolveAllowedOrigin(undefined, undefined), "*");
    assert.strictEqual(resolveAllowedOrigin("development", "https://example.com"), "*");
    assert.strictEqual(resolveAllowedOrigin("test", undefined), "*");
  });

  it("returns the configured CLIENT_ORIGIN in production", () => {
    assert.strictEqual(
      resolveAllowedOrigin("production", "https://trivia.example.com"),
      "https://trivia.example.com"
    );
  });

  it("trims whitespace around CLIENT_ORIGIN", () => {
    assert.strictEqual(
      resolveAllowedOrigin("production", "  https://trivia.example.com  "),
      "https://trivia.example.com"
    );
  });

  it("returns null in production when CLIENT_ORIGIN is unset or blank", () => {
    assert.strictEqual(resolveAllowedOrigin("production", undefined), null);
    assert.strictEqual(resolveAllowedOrigin("production", ""), null);
    assert.strictEqual(resolveAllowedOrigin("production", "   "), null);
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

describe("POST /api/questions CORS origin (production gate, ticket 131)", () => {
  let server: ColyseusTestServer<typeof appConfig>;
  let savedEnv: Record<string, string | undefined>;

  before(async () => {
    server = await getTestServer();
  });

  beforeEach(() => {
    savedEnv = {
      NODE_ENV: process.env.NODE_ENV,
      CLIENT_ORIGIN: process.env.CLIENT_ORIGIN
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

  // A deliberately-invalid body (400) is enough here — allowCrossOrigin sets
  // the header before the route handler runs, so it's present regardless of
  // the eventual status code, and this avoids mutating the question bank.
  it("dev (NODE_ENV unset): Access-Control-Allow-Origin is '*'", async () => {
    delete process.env.NODE_ENV;
    await assert.rejects(server.http.post("/api/questions", { body: {} }), (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.headers["access-control-allow-origin"], "*");
      return true;
    });
  });

  it("production with CLIENT_ORIGIN set: header is locked to that origin, not '*'", async () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_ORIGIN = "https://trivia.example.com";
    await assert.rejects(server.http.post("/api/questions", { body: {} }), (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.headers["access-control-allow-origin"], "https://trivia.example.com");
      return true;
    });
  });

  it("production without CLIENT_ORIGIN configured: header is omitted entirely", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.CLIENT_ORIGIN;
    await assert.rejects(server.http.post("/api/questions", { body: {} }), (err: any) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.headers["access-control-allow-origin"], undefined);
      return true;
    });
  });
});
