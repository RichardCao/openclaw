export function absolutizeRelativePreloadNodeOptions(
  nodeOptions: string | undefined,
  runtimeCwd: string,
): string | undefined;

export function runTsdownBuildMain(params?: {
  spawnSync?: unknown;
  cwd?: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  stdout?: { write: (value: string) => void };
  stderr?: { write: (value: string) => void };
  platform?: NodeJS.Platform;
}): number;
