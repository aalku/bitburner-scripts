import { NS } from "@ns";
import { assignments as untypedAssignments } from "assignments.js";

const assignments: { [workerName: string]: string } = untypedAssignments;

type TaskType = "hack" | "grow" | "weaken";

type ScriptIndexType = {
  [name in TaskType]: number;
};

const scripsIndex: ScriptIndexType = { hack: 0, grow: 1, weaken: 2 };

const scripts = ["batch_hack.js", "batch_grow.js", "batch_weaken.js", "helper_API_client.js", "Transceiver.js", "HackingStatistics.js"];
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
  cores: number | undefined;
  // workEndTimestamp: number | null;
};

type WorkerDataMap = {
  [workerName: string]: WorkerData;
};

type Task = {
  taskType: TaskType;
  threads: number;
  offset: number | null;
};

const targetData: TargetDataMap = {};

const workerData: WorkerDataMap = {};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let print = (_a: unknown) => {/* */ };

/** @param {NS} ns */
export async function main(ns: NS) {
  // print = ns.tprint;
  print = ns.print;
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
      cores: undefined
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
      try {
        if (!isWorking(w, ns)) {
          if (needsPrepare(ns, w.targetName)) {
            printReasonsToPrepare(w);
            doPrepare(ns, w);
          } else {
            doWork(ns, w);
          }
        }
      } catch (error) {
        const msg = `HackingController error with worker ${w.workerName}: ${error}`;
        print(msg);
        ns.toast(msg, "error");
      }
    }
    await ns.sleep(1000); // Or wait for something
  }

  function doWork(ns: NS, w: WorkerData) {
    const [hackThreads, weakenThreads1, growThreads, weakenThreads2] = calcHWGWThreads(w, ns);
    if (hackThreads > 0 && growThreads > 0) {
      const tasks = [
        { taskType: "hack", threads: hackThreads } as Task,
        { taskType: "weaken", threads: weakenThreads1 } as Task,
        { taskType: "grow", threads: growThreads } as Task,
        { taskType: "weaken", threads: weakenThreads2 } as Task,
      ];
      print(`Hacking ${w.targetName} from ${w.workerName}...`);
      launch(ns, w, tasks);
    } else {
      print(`There are not enough resources on ${w.workerName} to hack ${w.targetName}`);
    }
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
      ns.growthAnalyzeSecurity(
        growThreads,
        w.targetName,
        ns.getServer(w.workerName).cpuCores
      ),
      freeRamAfterGrow
    );
    print(
      `Preparing ${w.targetName} with ${weakenThreads1} th for w1, ${growThreads} for g and ${weakenThreads2} th for w2`
    );
    const tasks = [
      { taskType: "weaken", threads: weakenThreads1 } as Task,
      { taskType: "grow", threads: growThreads } as Task,
      { taskType: "weaken", threads: weakenThreads2 } as Task,
    ].filter(t => t.threads > 0);
    launch(ns, w, tasks);
  }

  function launch(ns: NS, w: WorkerData, tasks: Task[]) {
    const weakenTime = Math.ceil(ns.getWeakenTime(w.targetName));
    const growTime = Math.ceil(ns.getGrowTime(w.targetName));
    const hackTime = Math.ceil(ns.getHackTime(w.targetName));
    function getTime(t: Task) {
      return t.taskType == "grow" ? growTime : t.taskType == "weaken" ? weakenTime : t.taskType == "hack" ? hackTime : 0;
    }
    const gap = 1000; // ms
    const margin = 2000; // ms
    const batchTime = Math.max(...tasks.map(t => getTime(t))) + gap * (tasks.length - 1);
    print(`tasks = ${JSON.stringify(tasks)}, Times=${ns.tFormat(weakenTime, true)},${ns.tFormat(growTime, true)},${ns.tFormat(hackTime, true)} totalTime=${ns.tFormat(batchTime, true)}`);
    const batchStartTime = Date.now() + margin;
    const batchEndTime = batchStartTime + batchTime;
    let gapNumber = tasks.length - 1;
    for (const t of tasks) {
      // First is the first to end, so greatest gap at the end so the rest end later
      const endTime = batchEndTime - gap * (gapNumber--);
      const startTime = endTime - getTime(t);
      const scriptName = scripts[scripsIndex[t.taskType]];
      print(`exec ${JSON.stringify([scriptName, w.workerName, t.threads, w.targetName, new Date(startTime), new Date(endTime), w.workerName])}`);
      ns.exec(scriptName, w.workerName, t.threads, w.targetName, startTime, endTime, w.workerName);
    }
    print(`totalBatch threads=${tasks.map(t => t.threads).reduce((o, c) => (o + c), 0)}, ram=${ns.formatRam(tasks.map(t => t.threads * getScriptRam(t.taskType)).reduce((o, c) => (o + c), 0))}`);
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
  // Save some ram at home
  const factor = w.workerName == "home" ? 0.8 : 1;
  return (ns.getServerMaxRam(w.workerName) - ns.getServerUsedRam(w.workerName)) * factor;
}

function calcMaxThreads(w: WorkerData, kind: TaskType, freeRam: number) {
  return freeRam / getScriptRam(kind);
}

function getScriptRam(kind: TaskType): number {
  const res = scriptsRam[scripsIndex[kind]];
  // print(`getScriptRam(${kind})=${res}`);
  return res;
}


function calcHWGWThreads(w: WorkerData, ns: NS) {
  const growRamPerThread = getScriptRam("grow");
  const hackRamPerThread = getScriptRam("hack");
  const weakenRamPerThread = getScriptRam("weaken");
  const freeRam = getFreeRam(ns, w);
  const maxMoney = ns.getServerMaxMoney(w.targetName);
  /** Step for the calc loop */
  const step = 0.01;
  /** How many threads to double growth multiplier */
  const c = ns.growthAnalyze(w.targetName, 1.000000001, w.cores) / Math.log2(1.000000001);
  /** Max grow multiplier if using all the ram */
  let maxGrowMultiplier = Math.pow(2, (freeRam / growRamPerThread) / c);
  /** Hack rate (1/grow) advancing a first step because we shouldn't only grow */
  let rate = 1 - (1 / maxGrowMultiplier) - step;
  while (rate >= step) {
    // print(`  tryRate(${rate})`);
    const growThreads = Math.ceil(ns.growthAnalyze(w.targetName, 1 / (1 - rate), w.cores));
    const freeRamAfterGrow = freeRam - growThreads * growRamPerThread;
    if (freeRamAfterGrow < 0) {
      // Shouldn't be possible
      throw new Error("Internal error 1 on calcHWGWThreads");
    }
    const hackThreads = Math.floor(ns.hackAnalyzeThreads(w.targetName, maxMoney * rate));
    const freeRamAfterHack = freeRamAfterGrow - hackThreads * hackRamPerThread;
    if (freeRamAfterHack < 0) {
      rate -= step;
      continue;
    }
    const weakenThreads1 = Math.max(Math.ceil(hackThreads * 0.002 / 0.05), 1);
    const weakenThreads2 = Math.max(Math.ceil(growThreads * 0.004 / 0.05), 1);
    const freeRamFinal = freeRamAfterHack - (weakenThreads1 + weakenThreads2) * weakenRamPerThread;
    if (freeRamFinal < 0) {
      rate -= step;
    } else {
      // SUCCESS
      print(`calcHWGWThreads(${JSON.stringify(w)})=[${hackThreads}, ${weakenThreads1}, ${growThreads}, ${weakenThreads2}],`
        + ` hackMoney=${ns.formatPercent(rate)}, freeRam=${ns.formatRam(freeRamFinal)}/${ns.formatRam(freeRam)}, maxGrowWithAllTheRam=${ns.formatPercent(maxGrowMultiplier)}`);
      return [hackThreads, weakenThreads1, growThreads, weakenThreads2];
    }
  }
  return [0, 0, 0, 0];
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
    Math.floor(calcMaxThreads(w, "weaken", freeRam)),
    Math.ceil(calcNeededWeakThreads(securityDecrease))
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
    Math.floor(calcMaxThreads(w, "grow", freeRam)),
    Math.ceil(calcNeededGrowThreads(ns, w.targetName))
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
