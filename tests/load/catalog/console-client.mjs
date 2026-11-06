import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function parseArgs(argv) {
  return Object.fromEntries(
    argv.map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, "").split("=");
      return [key, rest.length ? rest.join("=") : "true"];
    }),
  );
}

export function send(base, host, path, { method = "GET", headers = {}, body } = {}) {
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { ...headers, host }, setHost: false },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, cookies: res.headers["set-cookie"] ?? [], text });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function credentials() {
  if (process.env.CONSOLE_EMAIL && process.env.CONSOLE_PASSWORD) {
    return { email: process.env.CONSOLE_EMAIL, password: process.env.CONSOLE_PASSWORD };
  }
  const config = JSON.parse(readFileSync(`${repoRoot}src/PoliValko.Api/appsettings.Development.json`, "utf8"));
  const user = config.Seed.Users.find((u) => u.Role === "Admin");
  return { email: user.Email, password: user.Password };
}

export class ConsoleClient {
  constructor(base, host) {
    this.base = base;
    this.host = host;
    this.cookies = new Map();
    this.csrf = null;
  }

  async request(path, init = {}) {
    const headers = { ...(init.headers ?? {}) };
    let body = init.body;
    if (body instanceof FormData) {
      const encoded = new Request("http://form.local", { method: "POST", body });
      headers["content-type"] = encoded.headers.get("content-type");
      body = Buffer.from(await encoded.arrayBuffer());
    }
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    if (this.csrf && init.method && init.method !== "GET") headers["x-csrf-token"] = this.csrf;
    const response = await send(this.base, this.host, path, { method: init.method, headers, body });
    for (const cookie of response.cookies) {
      const [pair] = cookie.split(";");
      const [key, ...value] = pair.split("=");
      this.cookies.set(key.trim(), value.join("="));
    }
    return response;
  }

  async json(path, init) {
    const response = await this.request(path, init);
    if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${response.status}: ${response.text.slice(0, 400)}`);
    return response.text ? JSON.parse(response.text) : null;
  }

  async login() {
    const { email, password } = credentials();
    await this.json("/api/v1/console/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    this.csrf = (await this.json("/api/v1/console/auth/csrf")).token;
  }
}
