import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns: NS) {
  /** @type {string} */
  const file: string = ns.args[0] as string;
  /** @type {string[]} */
  const servers: string[] = ns.args.slice(1, ns.args.length) as string[];
  for (let s of servers) {
    if (!ns.scp(file, s)) {
      throw `Can't copy file ${file} to server ${s}`;
    }
  }
  ns.tprint(`File ${file} copied to ${servers.length} servers!`);
}

type autocompleteData = {
  scripts: string[];
  servers: string[];
  texts: string[];
  flags: Function;
};

/*
{
    servers: list of all servers in the game.
    txts:    list of all text files on the current server.
    scripts: list of all scripts on the current server.
    flags:   the same flags function as passed with ns. Calling this function adds all the flags as autocomplete arguments
}*/
export function autocomplete(data: autocompleteData, args: string[]) {
  // console.info("autocomplete", data, args);
  if (args.length == 0) {
    return data.scripts;
  } else {
    return data.servers;
  }
}
