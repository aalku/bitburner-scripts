/* eslint-disable no-constant-condition */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns: NS) {
  const operation = ns.args[0];
  if (operation == "rename") {
    if (ns.renamePurchasedServer(ns.args[1] as string, ns.args[2] as string)) {
      ns.tprint(
        `Server was renamed successfully from ${ns.args[1]} to ${ns.args[2]}`
      );
    } else {
      ns.tprint("Can't rename that server");
    }
  } else if (operation == "quote-buy-server") {
    const money = ns.getPurchasedServerCost(ns.args[1] as number);
    ns.tprint(
      `Buying a server with ${ns.formatRam(
        ns.args[1] as number
      )} would cost $${ns.formatNumber(money, 2)}`
    );
  } else if (operation == "buy-server") {
    const money = ns.getPurchasedServerCost(ns.args[1] as number);
    const ram = ns.args[1] as number;
    const servers = (ns.args[2] as string).split(/\s*,\s*/);
    for (const s of servers) {
      if (ns.serverExists(s)) {
        ns.tprint(`Already existing server ${s}`);
      } else if (ns.purchaseServer(s as string, ram)) {
        ns.tprint(
          `Bought server ${s} with ${ns.formatRam(
            ram
          )} for $${ns.formatNumber(money, 2)}`
        );
      } else {
        ns.tprint(`Could't buy server ${s}`);
      }
    }
  } else if (operation == "quote-upgrade-server") {
    const money = ns.getPurchasedServerUpgradeCost(ns.args[1] as string, ns.args[2] as number);
    ns.tprint(
      `Upgrading ${ns.args[1]} to ${ns.formatRam(
        ns.args[2] as number
      )} would cost $${ns.formatNumber(money, 2)}`
    );
  } else if (operation == "upgrade-server") {
    const servers = ns.args[2] as string;
    const memory = ns.args[1] as number;
    for (const server of servers.split(/\s*,\s*/)) {
      const money = ns.getPurchasedServerUpgradeCost(server, memory);
      if (ns.upgradePurchasedServer(server, memory)) {
        ns.tprint(
          `Server ${server} was upgraded to ${ns.formatRam(
            memory
          )} for $${ns.formatNumber(money, 2)}`
        );
      } else {
        ns.tprint("Can't make that upgrade");
      }
    }
  }
}

export function autocomplete(data: { servers: string[] }, args: string[]) {
  console.warn("autocomplete", data, args);
  try {
    if (args?.length) {
      if (args.length == 1) {
        return [
          "rename",
          "quote-buy-server",
          "quote-upgrade-server",
          "buy-server",
          "upgrade-server",
        ];
      } else {
        if (args[0] == "rename") {
          return data.servers;
        } else if (args[0] == "quote-buy-server") {
          return Array.from(
            { length: 20 },
            (_v, index) => "" + Math.pow(2, index)
          );
        } else if (args[0] == "quote-upgrade-server") {
          if (args.length == 2) {
            return data.servers;
          } else {
            return Array.from(
              { length: 20 },
              (_v, index) => "" + Math.pow(2, index)
            );
          }
        } else if (args[0] == "buy-server") {
          if (args.length == 1) {
            return [];
          } else {
            return Array.from(
              { length: 20 },
              (_v, index) => "" + Math.pow(2, index)
            );
          }
        } else if (args[0] == "upgrade-server") {
          if (args.length == 2) {
            return data.servers;
          } else {
            return Array.from(
              { length: 20 },
              (_v, index) => "" + Math.pow(2, index)
            );
          }
        }
      }
    }
    return [];
  } catch (error) {
    console.error(error);
    throw error;
  }

}
