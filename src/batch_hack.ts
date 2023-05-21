import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns: NS) {
  const target = ns.args[0] as string;
  const start = ns.args[1] as number;
  const end = ns.args[2] as number;
  const delay = start - Date.now();
  if (delay < 0) {
    ns.print(`ERROR: ${-delay} ms too late.`);
    return;
  }
  ns.print(`delay to start growing is ${delay} ms`);
  await ns.hack(target, { additionalMsec: delay });
  ns.print(`Finished with a delay of ${Date.now() - end}`);
}
