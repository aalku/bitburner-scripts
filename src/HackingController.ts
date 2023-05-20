import { NS } from "@ns";
import { assignments as untypedAssignments } from "assignments.js";

const assignments: { [workerName: string]: string } = untypedAssignments;

const scripts = ["batch_hack.js", "batch_grow.js", "batch_weak.js"];

type TargetData = {
  [targetName: string]: {
    targetName: string;
  };
};

type WorkerData = {
  [workerName: string]: {
    workerName: string;
  };
};

const targetData: TargetData = {};

const workerData: WorkerData = {};

/** @param {NS} ns */
export async function main(ns: NS) {
  const print = ns.tprint;
  await ns.sleep(1);
  const workers = Object.keys(assignments);
  const targets = [...new Set<string>(Object.values(assignments))];
  print("");
  print("Assignments: ");
  for (const worker of Object.keys(assignments)) {
    print(`  ${worker} --> ${assignments[worker]}`);
  }
  print("");

  // Prepare workers
  for (const worker of workers) {
    rootServer(worker, ns);
    ns.scp(scripts, worker);
    if (worker != "home") {
      for (const proc of ns.ps(worker)) {
        if (scripts.indexOf(proc.filename) < 0) {
          // TODO enable later
          // ns.scriptKill(proc.filename, worker);
        }
      }
    }
    // TODO assume all ram is ours to use
    workerData[worker] = { workerName: worker };
  }
  // Prepare targets
  for (const target of targets) {
    rootServer(target, ns);
    targetData[target] = { targetName: target };
  }
  await ns.sleep(1);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // TODO hack
    await ns.sleep(1000); // Or wait for something
  }
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
