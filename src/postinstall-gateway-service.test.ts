import { beforeEach, describe, expect, it, vi } from "vitest";

const readdirMock = vi.hoisted(() => vi.fn());
const readCommandMock = vi.hoisted(() => vi.fn());
const installMock = vi.hoisted(() => vi.fn());
const resolveGatewayProgramArgumentsMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  default: {
    readdir: readdirMock,
  },
  readdir: readdirMock,
}));

vi.mock("./daemon/service.js", () => ({
  resolveGatewayService: () => ({
    readCommand: readCommandMock,
    install: installMock,
  }),
}));

vi.mock("./daemon/program-args.js", () => ({
  resolveGatewayProgramArguments: resolveGatewayProgramArgumentsMock,
}));

const { VERSION } = await import("./version.js");
const { runPostinstallGatewayServiceRepair, shouldRunPostinstallGatewayServiceRepair } =
  await import("./postinstall-gateway-service.js");

describe("postinstall gateway service repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readdirMock.mockResolvedValue([]);
    readCommandMock.mockResolvedValue({
      programArguments: [
        "/usr/bin/node",
        "/opt/homebrew/bin/openclaw",
        "gateway",
        "--port",
        "18789",
      ],
      environment: {
        HOME: "/Users/test",
        OPENCLAW_CONFIG_PATH: "/Users/test/.openclaw/custom.json",
        OPENCLAW_GATEWAY_PORT: "18789",
        OPENCLAW_GATEWAY_TOKEN: "env-token",
        OPENCLAW_PROFILE: "work",
        OPENCLAW_SERVICE_VERSION: "2026.3.13",
      },
      workingDirectory: "/opt/homebrew/lib/node_modules/openclaw",
    });
    resolveGatewayProgramArgumentsMock.mockResolvedValue({
      programArguments: [
        "/usr/bin/node",
        "/opt/homebrew/bin/openclaw",
        "gateway",
        "--port",
        "18789",
      ],
      workingDirectory: "/opt/homebrew/lib/node_modules/openclaw",
    });
    installMock.mockResolvedValue(undefined);
  });

  it("skips when the install is not global npm", async () => {
    readdirMock.mockResolvedValue(["ai.openclaw.gateway.plist"]);

    const result = await runPostinstallGatewayServiceRepair({
      platform: "darwin",
      env: {
        HOME: "/Users/test",
        npm_config_global: "false",
      },
    });

    expect(result).toBe(false);
    expect(installMock).not.toHaveBeenCalled();
  });

  it("repairs the default LaunchAgent after global macOS installs", async () => {
    readdirMock.mockResolvedValue(["ai.openclaw.gateway.plist"]);
    resolveGatewayProgramArgumentsMock.mockResolvedValue({
      programArguments: [
        "/usr/bin/node",
        "/opt/homebrew/lib/node_modules/openclaw/dist/index.js",
        "gateway",
        "--port",
        "18789",
      ],
      workingDirectory: "/opt/homebrew/lib/node_modules/openclaw",
    });

    const result = await runPostinstallGatewayServiceRepair({
      platform: "darwin",
      env: {
        HOME: "/Users/test",
        npm_config_global: "true",
      },
    });

    expect(result).toBe(true);
    expect(installMock).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          HOME: "/Users/test",
        }),
        programArguments: [
          "/usr/bin/node",
          "/opt/homebrew/lib/node_modules/openclaw/dist/index.js",
          "gateway",
          "--port",
          "18789",
        ],
        environment: expect.objectContaining({
          HOME: "/Users/test",
          OPENCLAW_CONFIG_PATH: "/Users/test/.openclaw/custom.json",
          OPENCLAW_GATEWAY_TOKEN: "env-token",
          OPENCLAW_PROFILE: "work",
          OPENCLAW_GATEWAY_PORT: "18789",
          OPENCLAW_SERVICE_VERSION: expect.any(String),
        }),
      }),
    );
  });

  it("skips when users explicitly disable postinstall service repair", async () => {
    const shouldRun = shouldRunPostinstallGatewayServiceRepair({
      platform: "darwin",
      env: {
        npm_config_global: "true",
        OPENCLAW_SKIP_POSTINSTALL_GATEWAY_REPAIR: "1",
      },
      launchAgentFiles: ["ai.openclaw.gateway.plist"],
    });

    expect(shouldRun).toBe(false);
  });

  it("returns false silently when LaunchAgents dir does not exist", async () => {
    readdirMock.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const result = await runPostinstallGatewayServiceRepair({
      platform: "darwin",
      env: {
        HOME: "/Users/test",
        npm_config_global: "true",
      },
    });

    expect(result).toBe(false);
    expect(installMock).not.toHaveBeenCalled();
  });

  it("skips when the installed LaunchAgent already matches the current package", async () => {
    readdirMock.mockResolvedValue(["ai.openclaw.gateway.plist"]);
    readCommandMock.mockResolvedValue({
      programArguments: [
        "/usr/bin/node",
        "/opt/homebrew/lib/node_modules/openclaw/dist/index.js",
        "gateway",
        "--port",
        "18789",
      ],
      environment: {
        HOME: "/Users/test",
        OPENCLAW_SERVICE_VERSION: VERSION,
      },
      workingDirectory: "/opt/homebrew/lib/node_modules/openclaw",
    });
    resolveGatewayProgramArgumentsMock.mockResolvedValue({
      programArguments: [
        "/usr/bin/node",
        "/opt/homebrew/lib/node_modules/openclaw/dist/index.js",
        "gateway",
        "--port",
        "18789",
      ],
      workingDirectory: "/opt/homebrew/lib/node_modules/openclaw",
    });

    const result = await runPostinstallGatewayServiceRepair({
      platform: "darwin",
      env: {
        HOME: "/Users/test",
        npm_config_global: "true",
      },
    });

    expect(result).toBe(false);
    expect(installMock).not.toHaveBeenCalled();
  });

  it("swallows repair errors so npm update does not fail", async () => {
    readdirMock.mockResolvedValue(["ai.openclaw.gateway.plist"]);
    resolveGatewayProgramArgumentsMock.mockResolvedValue({
      programArguments: [
        "/usr/bin/node",
        "/opt/homebrew/lib/node_modules/openclaw/dist/index.js",
        "gateway",
        "--port",
        "18789",
      ],
      workingDirectory: "/opt/homebrew/lib/node_modules/openclaw",
    });
    installMock.mockRejectedValue(new Error("bootstrap failed"));
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    const result = await runPostinstallGatewayServiceRepair({
      platform: "darwin",
      env: {
        HOME: "/Users/test",
        npm_config_global: "true",
      },
      runtime,
    });

    expect(result).toBe(false);
    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining("LaunchAgent repair skipped: bootstrap failed"),
    );
  });
});
