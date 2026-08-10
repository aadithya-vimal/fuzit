export {
  activate,
  deactivate,
  registerDeactivationCleanup,
  type ExtensionContextLike,
  type ExtensionApi,
} from "./extension.js";
export {
  executeEngineCommand,
  type EngineAdapterOptions,
  type EngineAdapterResult,
} from "./adapter.js";
export {
  initializeWorkspaceCommand,
  runDoctorCommand,
  scanCommand,
  getContextCommand,
  type CommandContext,
  type CommandResponse,
  type GetContextOptions,
} from "./commands.js";
export {
  redactAbsolutePaths,
  renderPreview,
  writeToOutputChannel,
  type OutputChannelLike,
  type PreviewRendererOptions,
} from "./preview.js";
export {
  WatchRegistry,
  startWatchCommand,
  stopWatchCommand,
  type WatchState,
  type WatchController,
  type WatchRegistryEntry,
} from "./watch.js";
export {
  createSnapshotCommand,
  diffSnapshotCommand,
  graphNeighborsCommand,
  cacheStatusCommand,
  type SnapshotCommandContext,
  type SnapshotCommandResponse,
} from "./snapshot.js";
export {
  assertTrusted,
  isTrustRefusal,
  type TrustContext,
  type TrustCheckResult,
  type TrustRefusal,
} from "./trust.js";
export {
  normalizeRootPath,
  formatWorkspaceRootPicks,
  resolveWorkspaceRoot,
  PerRootStateManager,
  CancellableTaskRunner,
  type WorkspaceFolderLike,
  type QuickPickItemLike,
  type PerRootState,
  type ProgressReport,
  type TaskExecutionResult,
} from "./multi-root.js";
