/* eslint-disable no-constant-condition */
import { NS, ScriptArg, Server } from "@ns";

/* I don't share it, make your own... or we can trade :) */
const solveContractScript = "solveContract.js";

const scriptFlags = [
  ["mode", ""],
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
  isHacked() {
    return this.metadata.hasAdminRights;
  }
  compareOrder(s: ServerWrapper) {
    const [a, b] = [this.path, s.path];
    const [la, lb] = [a.length, b.length];
    return la < lb ? -1 : la > lb ? 1 : a == b ? 0 : a < b ? -1 : 1;
  }
  canBeOwned() {
    if (this.isHacked()) {
      return undefined;
    }
    if (
      portOpenTools >= this.metadata.numOpenPortsRequired &&
      !this.isHacked()
    ) {
      return true; // TODO
    } else {
      return false;
    }
  }
  canBeHacked(hackingLevel: number) {
    if (
      (this.canBeOwned() || this.isHacked()) &&
      hackingLevel >= this.metadata.requiredHackingSkill
    ) {
      return true; // TODO
    } else {
      return false;
    }
  }
  toString() {
    return JSON.stringify({
      n: this.name,
      d: this.path.length,
      h: this.isHacked(),
    });
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
  str: string,
  ns: NS,
  flags: { [key: string]: string[] | ScriptArg }
) {
  if (str == "own") {
    return (s: ServerWrapper) => s.canBeOwned();
  } else if (str == "power") {
    return (s: ServerWrapper) =>
      (s.isHacked() || s.canBeOwned()) && s.metadata.maxRam > 0;
  } else if (str == "money") {
    return (s: ServerWrapper) =>
      s.canBeHacked(ns.getHackingLevel()) && s.metadata.moneyMax > 0;
  } else if (str == "find") {
    return (s: ServerWrapper) => s.name == flags.name;
  } else if (str == "codingContracts") {
    return (s: ServerWrapper) => {
      return findServerCodingContracts(ns, s, flags).length > 0
    };
  }
  return () => true;
}

/** @param {NS} ns */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getSorter(str: string, ns: NS, flags: { [key: string]: string[] | ScriptArg }) {
  if (str == "money") {
    return (a: ServerWrapper, b: ServerWrapper) =>
      estimateMoneyPerSecond(ns, b) - estimateMoneyPerSecond(ns, a);
  } else if (str == "own" || str == "power") {
    return (a: ServerWrapper, b: ServerWrapper) =>
      b.metadata.maxRam - a.metadata.maxRam;
  } else {
    return (a: ServerWrapper, b: ServerWrapper) => a.compareOrder(b);
  }
}

/** @param {NS} ns */
function getToString(str: string | ScriptArg, ns: NS, flags: { [key: string]: string[] | ScriptArg }) {
  if (str == "money") {
    return (s: ServerWrapper) => {
      return JSON.stringify({
        n: s.name,
        mm: "$" + ns.formatNumber(s.metadata.moneyMax, 2),
        mt: ns.tFormat(maxTime(ns, s), false),
        hc: ns.formatPercent(ns.hackAnalyzeChance(s.name)),
        em: "$" + ns.formatNumber(estimateMoneyPerSecond(ns, s), 2) + "/s",
        th: estimateThreads(ns, s),
      });
    };
  } else if (str == "power" || str == "own") {
    return (s: ServerWrapper) =>
      JSON.stringify({
        n: s.name,
        ram: ns.formatRam(s.metadata.maxRam),
        path: shortestPath(ns, s),
      });
  } else if (str == "find") {
    return (s: ServerWrapper) => {
      return "connect " + shortestPath(ns, s).join("; connect ");
    };
  } else if (str == "codingContracts") {
    return (s: ServerWrapper) => JSON.stringify({
      n: s.name,
      contracts: findServerCodingContracts(ns, s, flags).map(f => ({ f, t: ns.codingcontract.getContractType(f, s.name), d: JSON.stringify(ns.codingcontract.getData(f, s.name)) })),
      path: "connect " + shortestPath(ns, s).join("; connect "),
    }, null, "  ");

  } else {
    return (s: ServerWrapper) => s.toString();
  }
}

/** @param {NS} ns */
export async function main(ns: NS) {
  if (ns.fileExists("BruteSSH.exe", "home")) {
    portOpenTools++;
  }
  if (ns.fileExists("FTPCrack.exe", "home")) {
    portOpenTools++;
  }
  if (ns.fileExists("relaySMTP.exe", "home")) {
    portOpenTools++;
  }
  if (ns.fileExists("SQLInject.exe", "home")) {
    portOpenTools++;
  }
  if (ns.fileExists("HTTPWorm.exe", "home")) {
    portOpenTools++;
  }
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
  [...servers.values()]
    .filter(getFilter(flags.mode as string, ns, flags))
    .sort(getSorter(flags.mode as string, ns, flags))
    .slice(0, flags.limit ? (flags.limit as number) : 999999999)
    .forEach((s) => {
      ns.tprint(`*** ${toStringFunction(s)}`);
      any = true;
      if (flags.mode == "codingContracts" && flags.action) {
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
          cc.forEach(f => {
            if (actionCount++ < limit) {
              const pid = ns.run(solveContractScript, 1, s.name, f);
              if (!pid) {
                ns.tprint(`Can't run script ${solveContractScript}`);
              }
            }
            if (actionCount == limit + 1) {
              ns.alert(`Abort solve after limit ${limit}. You can use --limit=number to rise it or filter with --type="type".`);
            }
          });
        }
      } else if (flags.mode == "own" && flags.action == "own") {
        let ports = ns.getServerNumPortsRequired(s.name);
        if (ns.fileExists("BruteSSH.exe", "home")) {
          ns.brutessh(s.name);
          ports--;
        }
        if (ns.fileExists("FTPCrack.exe", "home")) {
          ns.ftpcrack(s.name);
          ports--;
        }
        if (ns.fileExists("relaySMTP.exe", "home")) {
          ns.relaysmtp(s.name);
          ports--;
        }
        if (ns.fileExists("SQLInject.exe", "home")) {
          ns.sqlinject(s.name);
          ports--;
        }
        if (ns.fileExists("HTTPWorm.exe", "home")) {
          ns.httpworm(s.name);
          ports--;
        }
        if (ports <= 0) {
          ns.nuke(s.name);
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

function maxTime(ns: NS, s: ServerWrapper): number {
  return Math.max(
    ns.getHackTime(s.name),
    ns.getGrowTime(s.name),
    ns.getWeakenTime(s.name)
  );
}

function estimateThreads(ns: NS, s: ServerWrapper) {
  return Math.ceil(ns.growthAnalyze(s.name, 4));
}

function estimateMoneyPerSecond(ns: NS, s: ServerWrapper): number {
  return (
    (s.metadata.moneyMax * (0.75) * ns.hackAnalyzeChance(s.name)) /
    (maxTime(ns, s) / 1000)
  );
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