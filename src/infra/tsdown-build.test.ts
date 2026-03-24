import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  absolutizeRelativePreloadNodeOptions,
  runTsdownBuildMain,
} from "../../scripts/tsdown-build.mjs";

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-tsdown-build-"));
  try {
    return await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("tsdown-build script", () => {
  it("absolutizes relative preload NODE_OPTIONS for the inner tsdown run", async () => {
    await withTempDir(async (tmp) => {
      const runtimeCwd = path.join(tmp, "runtime with spaces");
      const packageRoot = path.join(tmp, "repo");
      await fs.mkdir(runtimeCwd, { recursive: true });
      await fs.mkdir(packageRoot, { recursive: true });

      const calls: Array<{
        cmd: string;
        args: string[];
        options: {
          cwd?: string;
          env?: NodeJS.ProcessEnv;
        };
      }> = [];

      const exitCode = runTsdownBuildMain({
        cwd: runtimeCwd,
        execArgv: [],
        env: {
          ...process.env,
          OPENCLAW_RUNNER_BUILD_PACKAGE_ROOT: packageRoot,
          NODE_OPTIONS: '--require ./loader.cjs --import "./loader.mjs" --max-old-space-size=4096',
        },
        spawnSync: (cmd: string, args: string[], options: unknown) => {
          calls.push({
            cmd,
            args,
            options: options as { cwd?: string; env?: NodeJS.ProcessEnv },
          });
          return { status: 0, stdout: "", stderr: "" };
        },
        stdout: { write: () => undefined },
        stderr: { write: () => undefined },
      });

      expect(exitCode).toBe(0);
      expect(calls).toEqual([
        {
          cmd: "pnpm",
          args: ["exec", "tsdown", "--config-loader", "unrun", "--logLevel", "warn"],
          options: expect.objectContaining({
            cwd: packageRoot,
            env: expect.objectContaining({
              NODE_OPTIONS: `--require "${path.join(runtimeCwd, "loader.cjs")}" --import "${path.join(runtimeCwd, "loader.mjs")}" --max-old-space-size=4096`,
            }),
          }),
        },
      ]);
    });
  });

  it("forwards preserved execArgv into the inner tsdown run", async () => {
    await withTempDir(async (tmp) => {
      const runtimeCwd = path.join(tmp, "runtime with spaces");
      const packageRoot = path.join(tmp, "repo");
      await fs.mkdir(runtimeCwd, { recursive: true });
      await fs.mkdir(packageRoot, { recursive: true });

      const calls: Array<{
        cmd: string;
        args: string[];
        options: {
          cwd?: string;
          env?: NodeJS.ProcessEnv;
        };
      }> = [];

      const exitCode = runTsdownBuildMain({
        cwd: runtimeCwd,
        execArgv: ["--conditions=dev", "--max-old-space-size=4096", "--require", "./loader.cjs"],
        env: {
          ...process.env,
          OPENCLAW_RUNNER_BUILD_PACKAGE_ROOT: packageRoot,
          NODE_OPTIONS: "--trace-warnings",
        },
        spawnSync: (cmd: string, args: string[], options: unknown) => {
          calls.push({
            cmd,
            args,
            options: options as { cwd?: string; env?: NodeJS.ProcessEnv },
          });
          return { status: 0, stdout: "", stderr: "" };
        },
        stdout: { write: () => undefined },
        stderr: { write: () => undefined },
      });

      expect(exitCode).toBe(0);
      expect(calls).toEqual([
        {
          cmd: "pnpm",
          args: ["exec", "tsdown", "--config-loader", "unrun", "--logLevel", "warn"],
          options: expect.objectContaining({
            cwd: packageRoot,
            env: expect.objectContaining({
              NODE_OPTIONS: `--trace-warnings --conditions=dev --max-old-space-size=4096 --require "${path.join(runtimeCwd, "loader.cjs")}"`,
            }),
          }),
        },
      ]);
    });
  });

  it("keeps bare preload specifiers unchanged while absolutizing relative ones", () => {
    expect(
      absolutizeRelativePreloadNodeOptions(
        "--require tsx --loader ./loader.mjs --import=../importer.mjs",
        "/tmp/runtime",
      ),
    ).toBe(
      `--require tsx --loader ${path.resolve("/tmp/runtime", "loader.mjs")} --import=${path.resolve("/tmp/runtime", "../importer.mjs")}`,
    );
  });
});
