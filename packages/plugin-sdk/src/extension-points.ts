import type {
  ContextBundle,
  FileContextItem,
  FileRecord,
  GraphEdge,
  GraphNode,
  PolicyDecision,
  PluginCapability,
  PluginManifest,
  SecurityFinding,
  SourceLocation,
} from "@fuzit/schemas";

/**
 * Parser extension point input context.
 */
export interface PluginParserInput {
  readonly fileRecord: FileRecord;
  readonly textContent: string;
}

/**
 * Parsed symbol definition emitted by a parser extension.
 */
export interface PluginSymbolDefinition {
  readonly name: string;
  readonly kind:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "variable"
    | "constant"
    | "enum"
    | "method"
    | "other";
  readonly location?: SourceLocation;
}

/**
 * Parsed import reference emitted by a parser extension.
 */
export interface PluginImportReference {
  readonly source: string;
  readonly importedSymbols: readonly string[];
}

/**
 * Output payload returned by a parser extension point.
 */
export interface PluginParserOutput {
  readonly symbols: readonly PluginSymbolDefinition[];
  readonly imports?: readonly PluginImportReference[];
}

/**
 * Renderer extension point input context.
 */
export interface PluginRendererInput {
  readonly bundle: ContextBundle;
  readonly options?: Record<string, unknown>;
}

/**
 * Output payload returned by a renderer extension point.
 */
export interface PluginRendererOutput {
  readonly renderedText: string;
  readonly formatName: string;
  readonly mimeType?: string;
}

/**
 * Profile extension point input context.
 */
export interface PluginProfileInput {
  readonly taskDescription: string;
  readonly profileName: string;
}

/**
 * Output payload returned by a profile extension point.
 */
export interface PluginProfileOutput {
  readonly profileName: string;
  readonly maxDepth?: number;
  readonly includeGitHistory?: boolean;
  readonly includeSymbolGraph?: boolean;
  readonly rules?: Record<string, unknown>;
}

/**
 * Policy extension point input context.
 */
export interface PluginPolicyInput {
  readonly item: FileContextItem;
  readonly workspaceRoot: string;
}

/**
 * Output payload returned by a policy extension point.
 */
export interface PluginPolicyOutput {
  readonly decision: PolicyDecision;
  readonly reason?: string;
}

/**
 * Secret detector extension point input context.
 */
export interface PluginSecretDetectorInput {
  readonly textContent: string;
  readonly filePath: string;
}

/**
 * Output payload returned by a secret detector extension point.
 */
export interface PluginSecretDetectorOutput {
  readonly findings: readonly SecurityFinding[];
}

/**
 * Ranker extension point input context.
 */
export interface PluginRankerInput {
  readonly items: readonly FileContextItem[];
  readonly taskDescription: string;
}

/**
 * Ranked item score entry.
 */
export interface PluginRankerScoreEntry {
  readonly itemId: string;
  readonly score: number;
  readonly reasoning?: string;
}

/**
 * Output payload returned by a ranker extension point.
 */
export interface PluginRankerOutput {
  readonly scores: readonly PluginRankerScoreEntry[];
}

/**
 * Graph enricher extension point input context.
 */
export interface PluginGraphEnricherInput {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/**
 * Output payload returned by a graph enricher extension point.
 */
export interface PluginGraphEnricherOutput {
  readonly addedNodes?: readonly GraphNode[];
  readonly addedEdges?: readonly GraphEdge[];
}

/**
 * Map of capability tokens to their respective input/output types.
 */
export interface PluginCapabilityContractMap {
  parser: { input: PluginParserInput; output: PluginParserOutput };
  renderer: { input: PluginRendererInput; output: PluginRendererOutput };
  profile: { input: PluginProfileInput; output: PluginProfileOutput };
  policy: { input: PluginPolicyInput; output: PluginPolicyOutput };
  "secret-detector": {
    input: PluginSecretDetectorInput;
    output: PluginSecretDetectorOutput;
  };
  ranker: { input: PluginRankerInput; output: PluginRankerOutput };
  "graph-enricher": {
    input: PluginGraphEnricherInput;
    output: PluginGraphEnricherOutput;
  };
  provider: { input: Record<string, unknown>; output: Record<string, unknown> };
  collector: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };
}

/**
 * Type-safe handler function signature for an extension capability.
 */
export type PluginHandler<C extends PluginCapability> = (
  input: PluginCapabilityContractMap[C]["input"],
) =>
  | Promise<PluginCapabilityContractMap[C]["output"]>
  | PluginCapabilityContractMap[C]["output"];

/**
 * Plugin implementation container interface.
 */
export interface PluginInstance {
  readonly manifest: PluginManifest;
  readonly handlers: Partial<{
    [C in PluginCapability]: PluginHandler<C>;
  }>;
  readonly onInit?: () => Promise<void> | void;
  readonly onShutdown?: () => Promise<void> | void;
}

/**
 * Type-safe helper for constructing a compliant Fuzit plugin instance.
 */
export function createPlugin(plugin: PluginInstance): PluginInstance {
  for (const capability of plugin.manifest.capabilities) {
    if (!plugin.handlers[capability]) {
      throw new Error(
        `Plugin '${plugin.manifest.id}' declares capability '${capability}' but provides no handler implementation for it.`,
      );
    }
  }
  return plugin;
}
