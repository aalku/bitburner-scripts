import { NS } from "@ns";
import { assignments as untypedAssignments } from "assignments.js";

const assignments: { [workerName: string]: string } = untypedAssignments;

const scripsIndex = { hack: 0, grow: 1, weaken: 2 };
const scripts = ["batch_hack.js", "batch_grow.js", "batch_weak.js"];
let scriptsRam: number[];

type TargetData = {
  targetName: string;
};

type TargetDataMap = {
  [targetName: string]: TargetData;
};

type WorkerData = {
  workerName: string;
  targetName: string;
  // workEndTimestamp: number | null;
};

type WorkerDataMap = {
  [workerName: string]: WorkerData;
};

const targetData: TargetDataMap = {};

const workerData: WorkerDataMap = {};

/** @param {NS} ns */
export async function main(ns: NS) {
  const print = ns.tprint;
  scriptsRam = scripts.map((s) => ns.getScriptRam(s));

  await ns.sleep(1);
  const workers = Object.keys(assignments);
  const targets = [...new Set<string>(Object.values(assignments))];

  // Prepare workers
  for (const worker of workers) {
    rootServer(worker, ns);
    ns.scp(scripts, worker);
    if (worker != "home") {
      for (const proc of ns.ps(worker)) {
        if (scripts.indexOf(proc.filename) < 0) {
          // assume all ram is ours to use so kill anything else
          ns.scriptKill(proc.filename, worker);
        }
      }
    }
    workerData[worker] = {
      workerName: worker,
      targetName: assignments[worker],
    };
  }
  // Prepare targets
  for (const target of targets) {
    rootServer(target, ns);
    targetData[target] = {
      targetName: target,
    };
  }
  // Look for conflicts
  const conflicts = Object.entries(
    workers
      .map((w) => ({ t: assignments[w], w: w }))
      .reduce((res, x) => {
        const res2 = { ...res };
        res2[x.t] = res2[x.t] || [];
        res2[x.t].push(x.w);
        return res2;
      }, {} as any)
  )
    .map((e) => ({ t: e[0], w: e[1] as string[] }))
    .filter((x) => x.w.length >= 2);
  if (conflicts?.length) {
    ns.alert(
      `Assignment conflicts (only first worker will do the work): ${JSON.stringify(
        conflicts,
        null,
        "  "
      )}`
    );
    // Remove the conflicts
    for (const c of conflicts) {
      for (const w of c.w.slice(1)) {
        // cancel except the first one
        delete assignments[w];
        delete workerData[w];
      }
    }
  }
  await ns.sleep(1);
  // Now the main loop launching work and waiting for it to finish
  // eslint-disable-next-line no-constant-condition
  while (true) {
    for (const w of Object.values(workerData)) {
      if (!isWorking(w, ns)) {
        if (needsPrepare(ns, w.targetName)) {
          printReasonsToPrepare(w);
          doPrepare(ns, w);
        } else {
          print(
            `Let's give some work to ${w.workerName} hacking ${w.targetName}`
          );
        }
        // TODO hack
      }
    }
    await ns.sleep(1000); // Or wait for something
  }

  function doPrepare(ns: NS, w: WorkerData) {
    const [weakenThreads1, freeRamAfterWeaken1] = calcWeakenThreads(
      w,
      ns.getServerSecurityLevel(w.targetName) -
        ns.getServerMinSecurityLevel(w.targetName),
      getFreeRam(ns, w)
    );
    const [growThreads, freeRamAfterGrow] = calcGrowThreads(
      ns,
      w,
      freeRamAfterWeaken1
    );
    const [weakenThreads2, freeRamAfterWeaken2] = calcWeakenThreads(
      w,
      ns.growthAnalyzeSecurity(growThreads, w.targetName, ns.getServer(w.workerName).cpuCores),
      freeRamAfterGrow
    );
    print(
      `Preparing ${w.targetName} with ${weakenThreads1} th for w1, ${growThreads} for g and ${weakenThreads2} th for w2`
    );
    // TODO
  }

  function printReasonsToPrepare(w: WorkerData) {
    const reasons = ([] as string[])
      .concat(
        ns.getServerMoneyAvailable(w.targetName) <
          ns.getServerMaxMoney(w.targetName)
          ? ["should grow money"]
          : []
      )
      .concat(
        ns.getServerSecurityLevel(w.targetName) >
          ns.getServerMinSecurityLevel(w.targetName)
          ? ["should weaken security"]
          : []
      )
      .join(" and ");
    print(
      `Let's make ${w.workerName} prepare ${w.targetName} because ${reasons}`
    );
  }
}

function getFreeRam(ns: NS, w: WorkerData) {
  return ns.getServerMaxRam(w.workerName) - ns.getServerUsedRam(w.workerName);
}

function calcMaxThreads(w: WorkerData, kind: string, freeRam: number) {
  return freeRam / getScriptRam(kind);
}

function getScriptRam(kind: string): number {
  return scriptsRam[(scripsIndex as any)[kind]];
}

function calcWeakenThreads(
  w: WorkerData,
  securityDecrease: number,
  freeRam: number
) {
  function calcNeededWeakThreads(securityDecrease: number): number {
    return Math.ceil(securityDecrease / 0.05);
  }
  const weakenThreads = Math.min(
    calcMaxThreads(w, "weaken", freeRam),
    calcNeededWeakThreads(securityDecrease)
  );
  freeRam -= getScriptRam("weaken") * weakenThreads;
  return [weakenThreads, freeRam] as const;
}

function calcGrowThreads(ns: NS, w: WorkerData, freeRam: number) {
  function calcNeededGrowThreads(ns: NS, t: string): number {
    const growth = ns.getServerMaxMoney(t) / ns.getServerMoneyAvailable(t);
    return growth == 1 ? 0 : Math.ceil(ns.growthAnalyze(t, growth));
  }
  const growThreads = Math.min(
    calcMaxThreads(w, "grow", freeRam),
    calcNeededGrowThreads(ns, w.targetName)
  );
  freeRam -= getScriptRam("grow") * growThreads;
  return [growThreads, freeRam] as const;
}

function needsPrepare(ns: NS, target: string) {
  return (
    ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target) ||
    ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target)
  );
}

function isWorking(w: WorkerData, ns: NS) {
  return (
    ns.ps(w.workerName).find((p) => scripts.indexOf(p.filename) >= 0) !=
    undefined
  );
}

/** @param {NS} ns */
function rootServer(server: string, ns: NS) {
  if (ns.fileExists("BruteSSH.exe", "home")) {
    ns.brutessh(server);
  }
  if (ns.fileExists("FTPCrack.exe", "home")) {
    ns.ftpcrack(server);
  }
  if (ns.fileExists("relaySMTP.exe", "home")) {
    ns.relaysmtp(server);
  }
  if (ns.fileExists("SQLInject.exe", "home")) {
    ns.sqlinject(server);
  }
  if (ns.fileExists("HTTPWorm.exe", "home")) {
    ns.httpworm(server);
  }
  ns.nuke(server);
}
