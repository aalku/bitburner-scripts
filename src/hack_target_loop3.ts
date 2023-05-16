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
  const threads = ns.args[2] as string; // Should be the same as -t threads
  const toast = true;
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
        ns.toast("Helper Server didn't respond");
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
      if (toast) {
        ns.toast(msg);
      }
    }
  }
}
