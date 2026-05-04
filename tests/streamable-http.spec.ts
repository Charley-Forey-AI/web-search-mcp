import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate free port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForServerReady(
  child: ChildProcessWithoutNullStreams,
  timeoutMs = 20_000,
): Promise<void> {
  const start = Date.now();
  let output = "";
  await new Promise<void>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      output += chunk.toString("utf-8");
      if (output.includes("streamable_mcp_listening")) {
        cleanup();
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        cleanup();
        reject(new Error(`Server start timeout\n${output}`));
      }
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`Server exited early with code ${code}\n${output}`));
    };
    const cleanup = () => {
      child.stderr.off("data", onData);
      child.off("exit", onExit);
    };
    child.stderr.on("data", onData);
    child.on("exit", onExit);
  });
}

describe("streamable MCP HTTP server", () => {
  let child: ChildProcessWithoutNullStreams;
  let baseUrl: string;
  const mcpPath = "/mcp/search";

  beforeAll(async () => {
    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["--import", "tsx", "src/index.ts", "--port", String(port)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEARCH_PROVIDER: "duckduckgo",
        MCP_AUTH_TOKEN: "test-token",
        MCP_BASE_PATH: mcpPath,
      },
      stdio: "pipe",
    });
    await waitForServerReady(child);
  }, 30_000);

  afterAll(async () => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  });

  it("returns health JSON", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("returns 404 for unknown route", async () => {
    const res = await fetch(`${baseUrl}/nonsense`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("rejects unauthenticated mcp requests when token is enabled", async () => {
    const res = await fetch(`${baseUrl}${mcpPath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });
});
