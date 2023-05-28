/* eslint-disable no-constant-condition */
import { NS, ScriptArg, Server } from "@ns";
import { solve } from "solveContract";

const scriptFlags = [
  ["name", ""],
  ["limit", 0],
  ["type", ""],
  ["action", ""]
];

let portOpenTools = 0;

/** @param {NS} ns */
function shortestPath(ns: NS, sw: ServerWrapper) {
  const path = [...sw.path, sw.name];
  // cortar por el ultimo que cumpla sn=>getServer(sn).backdoorInstalled, pero incluir ese
  for (let i = path.length - 1; i >= 0; i--) {
    const s2 = ns.getServer(path[i]);
    if (s2.backdoorInstalled) {
      return path.splice(i);
    }
  }
  return path;
}

/** @param {NS} ns */
/** @constructor */
class ServerWrapper {
  name: string;
  path: string[];
  metadata: Server;

  updatePath(path2: string[]) {
    if (!this.path || (path2 && this.path.length < this.path.length)) {
      this.path = path2;
    }
  }
  compareOrder(s: ServerWrapper) {
    const [a, b] = [this.path, s.path];
    const [la, lb] = [a.length, b.length];
    return la < lb ? -1 : la > lb ? 1 : a == b ? 0 : a < b ? -1 : 1;
  }

  constructor(ns: NS, name: string, path: string[]) {
    this.name = name;
    this.path = path;
    /** @type {Server} */
    this.metadata = ns.getServer(name);
  }
}

/** @param {NS} ns */
function getFilter(
  ns: NS,
  flags: { [key: string]: string[] | ScriptArg }
) {
  return (s: ServerWrapper) => {
    return findServerCodingContracts(ns, s, flags).length > 0
  };
}

/** @param {NS} ns */
function getToString(str: string | ScriptArg, ns: NS, flags: { [key: string]: string[] | ScriptArg }) {
  return (s: ServerWrapper) => JSON.stringify({
    n: s.name,
    contracts: findServerCodingContracts(ns, s, flags).map(f => ({ f, t: ns.codingcontract.getContractType(f, s.name), d: JSON.stringify(ns.codingcontract.getData(f, s.name)) })),
    path: "connect " + shortestPath(ns, s).join("; connect "),
  }, null, "  ");
}

/** @param {NS} ns */
export async function main(ns: NS) {
  const flags: { [key: string]: string[] | ScriptArg } = ns.flags(scriptFlags);
  const servers = new Map();
  const deep = async function (host = "", path: string[] = []) {
    const found = ns.scan(host || undefined);
    found
      .filter((x) => servers.has(x))
      .forEach((s) => {
        servers.get(s).updatePath(path);
      });
    const newServers = found.filter((x) => !servers.has(x));
    if (newServers.length > 0) {
      newServers.forEach((s) => servers.set(s, new ServerWrapper(ns, s, path)));
      newServers.forEach((s) => deep(s, [...path, s]));
    }
  };
  ns.clearLog();
  await deep();
  let any = false;
  let actionCount = 0;
  const toStringFunction = getToString(flags.mode as string, ns, flags);
  const filteredServers = [...servers.values()]
    .filter(getFilter(ns, flags))
    .slice(0, flags.limit ? (flags.limit as number) : 999999999);
  for (const s of filteredServers) {
      ns.tprint(`*** ${toStringFunction(s)}`);
      any = true;
      if (flags.action) {
        const cc = findServerCodingContracts(ns, s, flags);
        if (flags.action == "cat") {
          const limit = flags.limit ? flags.limit as number : 10;
          cc.forEach(f => {
            if (actionCount++ < limit) {
              const type = ns.codingcontract.getContractType(f, s.name);
              const desc = ns.codingcontract.getDescription(f, s.name);
              const data = ns.codingcontract.getData(f, s.name);
              ns.alert(`${type}\n\n${desc}\n\ninput=${data}`);
            }
            if (actionCount == limit + 1) {
              ns.alert(`Abort cat after limit ${limit}. You can use --limit=number to rise it.`);
            }
          });
        } else if (flags.action == "solve") {
          const limit = flags.limit ? flags.limit as number : 10;
          for (const f of cc) {
            if (actionCount++ < limit) {
              await solve(s.name, f, ns);
              console.log("after await solve");
            }
            if (actionCount == limit + 1) {
              ns.alert(`Abort solve after limit ${limit}. You can use --limit=number to rise it or filter with --type="type".`);
            }
          };
        }
      }
    });
  if (!any) {
    ns.tprintf(
      "No results found after filter. Total results = %d",
      servers.size
    );
  }
}

function findServerCodingContracts(ns: NS, s: ServerWrapper, flags: { [key: string]: string[] | ScriptArg; }): string[] {
  const type = flags.type || null;
  const filter2 = !type ? (x: unknown) => true : (x: string) => {
    const thisType = ns.codingcontract.getContractType(x, s.name);
    return thisType == type;
    // ns.tprint(`  thisType="${thisType}", type="${type}", res="${res}"`);
  };
  const res = ns.ls(s.name).filter(f => f.endsWith(".cct")).filter(x => filter2(x));
  //  ns.tprint(`res=${res}`);
  return res;
}

export function autocomplete(data: { servers: string[] }, args: string[]) {
  console.info(data, args);
  let choices: string[] = [];
  if (args.length == 0) {
    choices = choices.concat(["--mode=find", "--mode=money", "--mode=own", "--mode=power", "--mode=codingContracts"]);
  }
  if (args.length == 1 && args[0] == "--mode=find") {
    choices = choices.concat([...data.servers.map((s) => "--name=" + s)]);
  }
  if (args.length == 1 && args[0] == "--mode=codingContracts") {
    // autocomplete is broken so don't bother
  }
  choices.concat(["--limit=10"]);
  return choices;
}