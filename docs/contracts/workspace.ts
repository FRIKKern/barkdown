/**
 * Proposed Barkdown contracts v1. DESIGN ONLY, not a shipped wire protocol.
 * Compile with npm run check. Adapt to audited upstream schemas before use.
 * Persisted boundaries need runtime validation, versioning, and migrations.
 */
export type ID = string;
export type RelativePath = string; // Must be canonicalized and validated by the host.
export type Revision = string;
export interface ContentAddress {
  instanceId: ID;
  workspaceId: ID;
  projectId: ID;
  dataset: string;
  documentId: ID;
  blockId?: ID;
  revision?: Revision;
}
export interface AgentExecutionContext {
  agentSessionId: ID;
  environmentId: ID;
  savedProjectId: ID;
  checkoutId: ID;
  workingFolder: RelativePath; // '' means this checkout's root; not a global cwd.
}
export interface RunBinding extends AgentExecutionContext {
  runId: ID;
  chatId: ID;
  capturedAt: string;
  resolvedRootIdentity: ID; // Host-resolved identity; client path strings are insufficient.
}
export interface AppNavigation {
  version: 1;
  recentChatIds: ID[];
  documentAddresses: ContentAddress[];
  activeView: {kind:'chat'; chatId:ID}|{kind:'document'; address:ContentAddress};
  // Intentionally no workingFolder, activeProjectId, or process cwd.
}
export interface ReadingAnchor { blockId?:ID; offset?:number; scrollFallback:number }
export interface FileTarget {
  environmentId: ID;
  savedProjectId: ID;
  checkoutId: ID;
  relativePath: RelativePath;
  range?: {startLine:number; startColumn?:number; endLine?:number; endColumn?:number};
}
export interface TabBase { id:ID; title:string; unread:boolean }
export interface DocumentTab extends TabBase {
  kind:'document';
  path:Array<{address:ContentAddress; reading:ReadingAnchor}>;
  focusedPathIndex:number;
}
export interface ProjectTab extends TabBase {
  kind:'project';
  target:FileTarget;
  bufferId:ID;
  caret:{offset:number; scroll:number};
  explorerOpen:boolean;
}
export interface WebsiteTab extends TabBase {
  kind:'website'; url:string; history:string[]; historyIndex:number;
  browserSessionId:ID; // Isolated host; no privileged bridge for page content.
}
export interface ReviewTab extends TabBase {
  kind:'review'; environmentId:ID; checkoutId:ID;
  baseRevision:string; targetRevision:string; selectedFile?:RelativePath;
  // Marking a review read is not commit/push/approval.
}
export interface ChatTab extends TabBase { kind:'chat'; chatId:ID }
export type WorkTab = DocumentTab|ProjectTab|WebsiteTab|ReviewTab|ChatTab;
export interface ChatWorkspace {
  version:1;
  chatId:ID;
  agentContext:AgentExecutionContext|null; // General/content-only chat may have none.
  tabs:WorkTab[];
  activeTabId:ID|null;
  composerDraft:string;
  chatScroll:number;
  layout:{chatFraction:number; expandedEditorTabId:ID|null}; // initial fraction .60
  follow:{enabled:boolean; lastEventId:ID|null; suppressedTargetKeys:string[]};
}
export interface NavigationPin {
  version:1; id:ID; title:string; createdAt:string;
  destination:
    | {kind:'chat'; chatId:ID; agentContext:AgentExecutionContext|null;
       tabs:WorkTab[]; activeTabId:ID|null; chatScroll:number; layout:ChatWorkspace['layout']}
    | {kind:'document'; tab:DocumentTab};
  // No buffer contents, credentials, operations, or transcript rollback.
}
export type ActivityTarget =
  | {kind:'document'; address:ContentAddress}
  | {kind:'file'; file:FileTarget}
  | {kind:'website'; url:string; browserSessionId:ID}
  | {kind:'review'; environmentId:ID; checkoutId:ID; base:string; target:string}
  | {kind:'chat'; chatId:ID};
export interface RunActivity {
  id:ID; sequence:number; runId:ID; chatId:ID; agentSessionId:ID;
  targetKey:string; target:ActivityTarget;
  phase:'opened'|'reading'|'proposed'|'committed'|'failed'|'cancelled';
  label:string; occurredAt:string;
  // Route using originating IDs, never the currently visible chat.
}
export interface FileBuffer {
  id:ID; target:FileTarget; text:string; baseContentHash:string;
  state:'clean'|'dirty'|'saving'|'conflict'|'failed';
}
export type FileWriteResult =
  | {status:'saved'; newContentHash:string}
  | {status:'conflict'; currentContentHash:string}
  | {status:'failed'; code:string; retryable:boolean};
export interface PaperProposal {
  id:ID; operationId:ID; runId:ID; chatId:ID; actorId:ID;
  address:ContentAddress; expectedRevision:Revision;
  operations:readonly unknown[]; // Import the real PortableDoc operation schema.
  state:'proposed'|'applying'|'applied'|'discarded'|'conflict'|'failed';
}
export type PaperApplyResult =
  | {status:'applied'; operationId:ID; resultingRevision:Revision; undoReceipt?:string}
  | {status:'conflict'; currentRevision:Revision}
  | {status:'rejected'; code:string};
export interface CapabilityScope {
  instanceId:ID; workspaceId:ID; projectId:ID; dataset:string;
}
export interface BarkparkAdapter {
  capabilities(scope:CapabilityScope):Promise<ReadonlySet<string>>;
  read(address:ContentAddress):Promise<{revision:Revision; portableDoc:unknown}>;
  apply(proposal:PaperProposal):Promise<PaperApplyResult>;
  search(scope:CapabilityScope,query:string,cursor?:string):Promise<{
    hits:Array<{address:ContentAddress; kind:'document'|'media'; title:string}>;
    cursor?:string;
  }>;
  backlinks(address:ContentAddress):Promise<ContentAddress[]>;
  // Tokens stay behind this boundary. These are proposed client methods, not HTTP routes.
}
export interface ExecutionHost {
  resolve(context:AgentExecutionContext):Promise<RunBinding['resolvedRootIdentity']>;
  readFile(target:FileTarget):Promise<{text:string; contentHash:string}>;
  writeFile(target:FileTarget,text:string,expectedContentHash:string):Promise<FileWriteResult>;
  startRun(binding:RunBinding,prompt:string):Promise<{commandReceiptId:ID}>;
  // A command receipt is not proof a tool action or content save completed.
}
