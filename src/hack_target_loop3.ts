/* eslint-disable no-constant-condition */
import { NS } from "@ns";
import { HelperClient } from "helper_API_client.js";

/**
 *
 * @param {NS} ns
 */
export async function main(ns: NS): Promise<void> {
  const target = ns.args[0] as string; // Target hostname
  const hostname = ns.args[1] as string; // This hostname
  const threads = ns.args[2] as number; // Should be the same as -t threads
  const tail = true;

  ns.clearLog();
  if (tail) {
    ns.tail();
  }

  const myName = `${hostname} - ${ns.getScriptName()} - ${JSON.stringify([
    ...ns.args,
  ])}`;
  const client = new HelperClient(ns, myName);

  while (true) {
    let advice;
    do {
      try {
        advice = await client.getHackingAdvice(target, threads);
      } catch (error) {
        ns.toast("Helper Server didn't respond (will retry in 1s): " + error);
        await new Promise((r) => setTimeout(r, 1000));
      }
    } while (!advice);
    advice = advice.splice(0, 1); // No concurrency allowed
    for (const item of advice) {
      // Only one, actually
      ns.print(
        `${new Date().toISOString()} - Will ${item.action} until ${new Date(
          item.seconds * 1000 + Date.now()
        ).toISOString()}`
      );
      let res;
      item.target = target;
      if (item.action == "weaken") {
        res = await ns.weaken(target, { threads: item.threads });
      } else if (item.action == "grow") {
        res = await ns.grow(target, { threads: item.threads });
      } else if (item.action == "hack") {
        res = await ns.hack(target, { threads: item.threads });
      } else {
        throw `Unknown action: ${item}`;
      }
      const msg = `${item.action} result is ${res}`;
      ns.print(msg);
      try {
        await client.reportTaskCompleted(item, res);
      } catch (error) {
        ns.toast("Error sending task report: " + error);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}
