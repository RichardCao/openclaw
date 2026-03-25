// @vitest-environment jsdom
import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderAgentOverview } from "./agents-panels-overview.ts";

function renderOverview(configForm: Record<string, unknown>) {
  const container = document.createElement("div");
  render(
    renderAgentOverview({
      agent: { id: "main", name: "Main" } as never,
      basePath: "",
      defaultId: "main",
      configForm,
      agentFilesList: null,
      agentIdentity: null,
      agentIdentityLoading: false,
      agentIdentityError: null,
      configLoading: false,
      configSaving: false,
      configDirty: false,
      modelCatalog: [],
      onConfigReload: () => undefined,
      onConfigSave: () => undefined,
      onModelChange: () => undefined,
      onModelFallbacksChange: () => undefined,
      onSelectPanel: () => undefined,
    }),
    container,
  );
  return container;
}

describe("renderAgentOverview", () => {
  it("hydrates the default-model selector from object-shaped defaults.model", async () => {
    const container = renderOverview({
      agents: {
        defaults: {
          model: {
            primary: "openai-codex/gpt-5.4",
          },
          models: {
            "google/gemini-2.5-pro": { alias: "gemini" },
            "openai-codex/gpt-5.4": {},
          },
        },
        list: [{ id: "main" }],
      },
    });
    await Promise.resolve();

    const modelSelect = container.querySelector<HTMLSelectElement>(".agent-model-fields select");

    expect(modelSelect?.value).toBe("openai-codex/gpt-5.4");
  });

  it("shows inherited default-model fallbacks for the default agent editor", async () => {
    const container = renderOverview({
      agents: {
        defaults: {
          model: {
            primary: "openai-codex/gpt-5.4",
            fallbacks: ["google/gemini-2.5-pro"],
          },
          models: {
            "google/gemini-2.5-pro": { alias: "gemini" },
            "openai-codex/gpt-5.4": {},
          },
        },
        list: [{ id: "main" }],
      },
    });
    await Promise.resolve();

    const chips = Array.from(container.querySelectorAll(".chip")).map((node) =>
      node.textContent?.replace("×", "").trim(),
    );

    expect(chips).toContain("google/gemini-2.5-pro");
  });
});
