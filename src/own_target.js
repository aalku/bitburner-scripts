import {getToolsFiles} from "tools.js";

function root(server, ns) {
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

/** @param {NS} ns */
export async function main(ns) {    
    const ownTarget = ns.args[0];
    const hackTarget = ns.args.length >= 2 ? ns.args[1] : "";

    ns.killall(ownTarget);
    root(ownTarget, ns);
    ns.scp(getToolsFiles(), ownTarget);
    if (hackTarget) {
        root(hackTarget, ns);
        const ownedScript = "hack_target_loop3.js";
        let freeRam = ns.getServerMaxRam(ownTarget) - ns.getServerUsedRam(ownTarget);
        let threads = Math.floor(freeRam / ns.getScriptRam(ownedScript));
        // Specific command line for hack_target3.js
        const pid = ns.exec(ownedScript, ownTarget, threads, hackTarget, ownTarget, threads);
    }
}

export function autocomplete(data, args) {
    return data.servers;
}