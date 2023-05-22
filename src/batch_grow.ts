import { NS } from "@ns";
import { HelperClient } from "helper_API_client.js";

/** @param {NS} ns */
export async function main(ns: NS) {
  const target = ns.args[0] as string;
  const start = ns.args[1] as number;
  const end = ns.args[2] as number;
  const hostname = ns.args[3] as string;
  const delay = start - Date.now();

  const myName = `${hostname} - ${ns.getScriptName()} - ${JSON.stringify([
    ...ns.args,
  ])}`;
  const client = new HelperClient(ns, myName);

  if (delay < 0) {
    ns.print(`ERROR: ${-delay} ms too late.`);
    return;
  }
  ns.print(`delay to start growing is ${delay} ms`);
  const res = await ns.grow(target, { additionalMsec: delay });
  ns.print(`Finished with a delay of ${Date.now() - end}`);
  try {
    await client.reportTaskCompleted({action:"grow", target}, res);
  } catch (error) {
    ns.toast("Error sending task report: " + error);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
