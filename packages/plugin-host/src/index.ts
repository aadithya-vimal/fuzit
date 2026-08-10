export {
  PluginClient,
  PluginHost,
  type PluginExecutionResult,
  type PluginHostOptions,
} from "./host.js";

export {
  satisfiesSemver,
  validatePluginCompatibility,
  type CompatibilityValidationOptions,
  type CompatibilityValidationResult,
} from "./compatibility.js";

export {
  PermissionBroker,
  type PermissionAuditRecord,
  type PermissionBrokerOptions,
  type PermissionOperation,
} from "./permission-broker.js";

export {
  DEFAULT_PLUGIN_RESOURCE_LIMITS,
  enforceDiagnosticLimits,
  type PluginResourceLimits,
} from "./resource-limits.js";

export interface PluginHostBoundary {
  readonly packageName: "@fuzit/plugin-host";
}
