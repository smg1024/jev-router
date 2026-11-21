import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const effort = {
  off: "Mechanical transformation or trivial lookup; no deliberate reasoning needed",
  low: "Straightforward explanation, localized edit, or routine question",
  medium: "Ordinary implementation, debugging, or analysis with several steps",
  high: "Difficult diagnosis, design trade-offs, or interacting constraints",
  xhigh: "Exceptionally difficult reasoning where additional deliberation is worth the cost",
};

export default function (pi: ExtensionAPI) {
  pi.registerVirtualModel({
    provider: "jev", id: "auto", name: "Auto (Jev)",
    async route(request, ctx) {
      const registry = ctx.modelRegistry;
      const content = request.messages.findLast(m => m.role === "user")?.content ?? "";
      const image = Array.isArray(content) && content.some(b => b.type === "image");
      const scope = ctx.scopedModels;
      const models = registry.getAvailable().filter(m => m.api !== "pi-virtual" &&
        (!scope.length || scope.some(s => s.model.provider === m.provider && s.model.id === m.id)) &&
        (!image || m.input.includes("image")));
      if (!models.length) throw new Error("jev/auto: no eligible physical chat model. Check Pi credentials, model scope and image support.");

      const prior = request.reason === "retry" ? request.failed : request.previous;
      if (request.reason !== "user" && prior) {
        const model = models.find(m => m.provider === prior.model.provider && m.id === prior.model.id);
        if (model) return { model, thinkingLevel: prior.thinkingLevel ?? "off" };
      }
      // Compaction and other internal calls aren't new user tasks.
      if (request.reason === "direct") return { model: models[0], thinkingLevel: "low" };

      const jev = registry.findOfType("classifier", "typesafe", "jev-latest");
      if (!jev) throw new Error("jev/auto: typesafe/jev-latest is unavailable. Check TYPESAFE_API_KEY.");
      const prompt = typeof content === "string" ? content : content.flatMap(b => b.type === "text" ? [b.text] : []).join("\n");
      const candidates = new Map<string, (typeof models)[number]>(models.map((m, i) => [`m${i}`, m] as const));
      const criteria = Object.fromEntries([...candidates].map(([key, m]) => [key,
        `${m.provider}/${m.id} (${m.name}); reasoning: ${m.reasoning}; context: ${m.contextWindow}; input/output rates per million tokens: ${m.cost.input}/${m.cost.output}`]));
      const result = await registry.classify(jev, {
        state: { prompt: prompt.slice(0, 16_000), imageAttached: image },
        questions: {
          model: { type: "choice", instructions: "Select a strong model for the task. Prefer models with stronger reasoning; choose a cheaper model only when the task is clearly trivial or routine. Zero rates may mean unknown pricing.", criteria },
          effort: { type: "choice", instructions: "Select the least thinking effort sufficient to complete this task reliably.", criteria: effort },
        },
      }, { signal: request.signal });
      request.signal?.throwIfAborted();
      if (result.stopReason !== "stop") throw new Error(`jev/auto: Jev classification failed: ${result.errorMessage ?? result.stopReason}`);
      const { model: pick, effort: level } = result.answers;
      const model = pick?.type === "choice" ? candidates.get(pick.choice) : undefined;
      if (!model || level?.type !== "choice" || !Object.hasOwn(effort, level.choice)) throw new Error("jev/auto: invalid classifier choice.");
      // Pi clamps this to the selected model's supported thinking levels before dispatch.
      return { model, thinkingLevel: model.reasoning ? level.choice as keyof typeof effort : "off" };
    },
  });
}
