import { parseModule } from './callerGraph';
import type { ResolveImport } from './callerGraph';
import { enclosingSymbols, symbolAt } from './feScanner';

export interface MountGraph {
  prefixes: Map<string, string[]>;
  unresolved: Array<{ file: string; line: number; target: string }>;
}

const MODULE_LEVEL = ' module';

// cm:guard `root.use(createDocumentRouter(deps))` mounts with NO prefix string — the child keeps the
// parent's path. Requiring a quoted prefix here drops that whole subtree off the map.
const MOUNT = /\b(\w+)\s*\.\s*use\s*\(\s*(?:(['"`])(\/[^'"`]*)\2\s*,\s*)?(?:async\s*)?(\w+)(?:\s*\.\s*(\w+))?/g;
const ROUTER_DECL = /(?:const|let|var)\s+(\w+)(?:\s*:\s*[\w.<>]+)?\s*=\s*(?:express\s*\.\s*)?Router\s*\(/g;
const APP_DECL = /(?:const|let|var)\s+(\w+)(?:\s*:\s*[\w.<>]+)?\s*=\s*(?:express|fastify|polka|restify)\s*\(\s*\)/g;
const ALIAS_CONST = /(?:const|let|var)\s+(\w+)(?:\s*:\s*[\w.<>]+)?\s*=\s*(\w+)\s*\(/g;
const ALIAS_PROP = /\b(\w+)\s*:\s*(\w+)\s*[(.]/g;
const RETURN_IDENT = /\breturn\s+(\w+)\s*;/g;
const RETURN_CALL = /\breturn\s+(\w+)\s*\(/g;
const ROUTE_RECEIVER = /\b(\w+)\s*\.\s*(?:get|post|put|patch|delete|options|all)\s*\(\s*['"`]\//g;
const FUNCTION_DEF = /(?:export\s+)?function\s+(\w+)\s*\(([\s\S]{0,400}?)\)\s*(?::[^{;]+)?\{/g;
const CALL_WITH_ROUTER = /\b(\w+)\s*\(\s*(\w+)\s*[,)]/g;

export function nodeKey(file: string, owner: string, receiver: string): string {
  return `${file}#${owner}#${receiver}`;
}

export function joinPrefix(prefix: string, path: string): string {
  const merged = `${prefix}/${path}`.replace(/\/{2,}/g, '/');
  return merged.length > 1 ? merged.replace(/\/$/, '') : '/';
}

interface FileFacts {
  file: string;
  routerVars: Map<string, string>;
  returns: Map<string, string>;
  aliases: Map<string, string>;
  constCalls: Array<{ owner: string; name: string; callee: string }>;
  returnCalls: Map<string, string>;
  registrars: Map<string, string>;
  handoffs: Array<{ callee: string; argument: string }>;
  mounts: Array<{ owner: string; receiver: string; prefix: string; target: string; line: number; explicit: boolean }>;
  seeds: Array<{ owner: string; receiver: string }>;
  imports: Map<string, string>;
}

function readFacts(file: string, content: string): FileFacts {
  const symbols = enclosingSymbols(content);
  const lineOf = (index: number) => content.slice(0, index).split('\n').length;
  const owner = (index: number) => symbolAt(symbols, lineOf(index), MODULE_LEVEL);
  const facts: FileFacts = {
    file,
    routerVars: new Map(),
    returns: new Map(),
    aliases: new Map(),
    constCalls: [],
    returnCalls: new Map(),
    registrars: new Map(),
    handoffs: [],
    mounts: [],
    seeds: [],
    imports: new Map(parseModule(content).imports.map((i) => [i.local, i.from])),
  };

  for (const m of content.matchAll(ROUTER_DECL)) facts.routerVars.set(m[1], owner(m.index));
  for (const m of content.matchAll(APP_DECL)) {
    facts.routerVars.set(m[1], owner(m.index));
    facts.seeds.push({ owner: owner(m.index), receiver: m[1] });
  }
  // cm:why A factory hands its router back by name — `createStageRouter` IS the `router` declared
  // inside it, and without that identity the prefix stops at the factory and never reaches a route.
  for (const m of content.matchAll(RETURN_IDENT)) facts.returns.set(owner(m.index), m[1]);
  for (const m of content.matchAll(ALIAS_CONST)) {
    if (!facts.aliases.has(m[1])) facts.aliases.set(m[1], m[2]);
    facts.constCalls.push({ owner: owner(m.index), name: m[1], callee: m[2] });
  }
  for (const m of content.matchAll(RETURN_CALL)) facts.returnCalls.set(owner(m.index), m[1]);
  // cm:guard Reads `platformRouter: platform.router` as well as `pipelineRouter: composeX(deps)` —
  // the DI object is often the only thing tying the name `app.use` mounts to its factory.
  for (const m of content.matchAll(ALIAS_PROP)) if (!facts.aliases.has(m[1])) facts.aliases.set(m[1], m[2]);

  // cm:why `registerExcelRoutes(router, deps)` hangs routes on a router it was HANDED — the prefix
  // lives at the call site, so without this pair the whole file reports paths relative to nothing.
  const routeReceivers = new Set([...content.matchAll(ROUTE_RECEIVER)].map((m) => m[1]));
  for (const m of content.matchAll(FUNCTION_DEF)) {
    for (const param of m[2].matchAll(/(\w+)\s*:/g)) {
      if (routeReceivers.has(param[1]) && !facts.routerVars.has(param[1])) facts.registrars.set(m[1], param[1]);
    }
  }
  for (const m of content.matchAll(CALL_WITH_ROUTER)) facts.handoffs.push({ callee: m[1], argument: m[2] });

  for (const m of content.matchAll(MOUNT)) {
    facts.mounts.push({
      owner: owner(m.index),
      receiver: m[1],
      prefix: m[3] ?? '/',
      target: m[5] ?? m[4],
      line: lineOf(m.index),
      explicit: m[3] !== undefined,
    });
  }
  return facts;
}

// cm:why Express paths are relative to the router they hang off, so a scan reports `GET /` for a
// route the frontend calls as `/api/v1/activities` — no BE↔FE link survives that gap.
export function buildMountGraph(
  files: Array<{ file: string; content: string }>,
  resolve: ResolveImport
): MountGraph {
  const facts = new Map<string, FileFacts>();
  const declaredIn = new Map<string, string>();
  const globalAliases = new Map<string, string>();

  for (const { file, content } of files) {
    const fileFacts = readFacts(file, content);
    facts.set(file, fileFacts);
    for (const [name, target] of fileFacts.aliases) if (!globalAliases.has(name)) globalAliases.set(name, target);
    for (const declaration of parseModule(content).declarations) {
      if (!declaredIn.has(declaration)) declaredIn.set(declaration, file);
    }
  }

  const homeOf = (from: FileFacts, name: string): string | null => {
    const specifier = from.imports.get(name);
    return (specifier ? resolve(from.file, specifier) : null) ?? declaredIn.get(name) ?? null;
  };

  // cm:guard A factory reached from another file becomes the router it returns, not the function —
  // resolving to the function itself would hang the prefix on a node no route ever names.
  const factoryNode = (file: string, name: string, seen = new Set<string>()): string | null => {
    const target = facts.get(file);
    if (!target || seen.has(`${file}#${name}`)) return null;
    seen.add(`${file}#${name}`);

    const returned = target.returns.get(name);
    if (returned && target.routerVars.get(returned) === name) return nodeKey(file, name, returned);
    for (const [variable, holder] of target.routerVars) if (holder === name) return nodeKey(file, name, variable);

    // cm:why `composePlatformModule` never calls `Router()` — it hands back what
    // `createPlatformRouter` built, so the prefix has to keep travelling to that inner factory.
    const chained = target.returnCalls.get(name);
    const candidates = [
      ...(chained ? [chained] : []),
      ...target.constCalls.filter((c) => c.owner === name).map((c) => c.callee),
    ];
    for (const callee of candidates) {
      const home = homeOf(target, callee);
      const node = home ? factoryNode(home, callee, seen) : null;
      if (node) return node;
    }
    return null;
  };

  const resolveTarget = (from: FileFacts, target: string): string | null => {
    const local = from.routerVars.get(target);
    if (local !== undefined) return nodeKey(from.file, local, target);

    let name = target;
    for (let step = 0; step < 4; step++) {
      const home = homeOf(from, name);
      const node = home ? factoryNode(home, name) : null;
      if (node) return node;
      const next = from.aliases.get(name) ?? globalAliases.get(name);
      if (!next || next === name) break;
      name = next;
    }
    return null;
  };

  const prefixes = new Map<string, string[]>();
  const unresolved: MountGraph['unresolved'] = [];
  const add = (node: string, prefix: string): boolean => {
    const existing = prefixes.get(node) ?? [];
    if (existing.includes(prefix)) return false;
    prefixes.set(node, [...existing, prefix].sort());
    return true;
  };

  let frontier: Array<{ node: string; prefix: string }> = [];
  for (const fileFacts of facts.values()) {
    for (const seed of fileFacts.seeds) {
      const node = nodeKey(fileFacts.file, seed.owner, seed.receiver);
      add(node, '');
      frontier.push({ node, prefix: '' });
    }
  }

  // cm:guard Bounded by rounds AND by a seen (node, prefix) pair: a router mounted into itself, or
  // a cycle through two modules, would otherwise grow the prefix without ever terminating.
  for (let round = 0; round < 10 && frontier.length > 0; round++) {
    const next: Array<{ node: string; prefix: string }> = [];
    for (const { node, prefix } of frontier) {
      const [file, , receiver] = node.split('#');
      const fileFacts = facts.get(file);
      if (!fileFacts) continue;
      // cm:guard Matched on the receiver alone: the owner is `symbolAt`'s nearest declaration, which
      // inside a long factory is a local const, so requiring it to match drops the mount entirely.
      for (const mount of fileFacts.mounts) {
        if (mount.receiver !== receiver) continue;
        const target = resolveTarget(fileFacts, mount.target);
        // cm:why A bare `use(middleware)` is indistinguishable from a bare router mount here, so an
        // unresolved one is normal traffic — only a mount that named a path is worth reporting.
        if (!target) {
          if (mount.explicit) unresolved.push({ file, line: mount.line, target: mount.target });
          continue;
        }
        const child = joinPrefix(prefix, mount.prefix);
        if (add(target, child)) next.push({ node: target, prefix: child });
      }

      for (const handoff of fileFacts.handoffs) {
        if (handoff.argument !== receiver) continue;
        const home = homeOf(fileFacts, handoff.callee);
        const parameter = home ? facts.get(home)?.registrars.get(handoff.callee) : undefined;
        if (!home || !parameter) continue;
        const node = nodeKey(home, handoff.callee, parameter);
        if (add(node, prefix)) next.push({ node, prefix });
      }
    }
    frontier = next;
  }

  return { prefixes, unresolved };
}

// cm:guard The owner is a best guess — `enclosingSymbols` reports the nearest declaration above a
// line, not the function containing it, so a local const inside a factory shadows the factory name.
export function prefixesFor(graph: MountGraph, file: string, owner: string, receiver: string): string[] {
  const exact = graph.prefixes.get(nodeKey(file, owner, receiver));
  if (exact) return exact;
  const union = new Set<string>();
  for (const [key, values] of graph.prefixes) {
    const parts = key.split('#');
    if (parts[0] === file && parts[2] === receiver) for (const value of values) union.add(value);
  }
  return [...union].sort();
}
