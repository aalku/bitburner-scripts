import { NS } from "@ns";
/** 
 * This value is how many threads you need to duplicate the server money available (not
 *  over max) and it depends on server and it seems to be constant depending on server
 *  and player stats.
 * Maybe we can't calculate if the server is 100% full of money.
 * It seems to depend on the server security level and growth value.
 * We should calculate it with the server security level at minimum and money not 100%.
 * 
 * So we will cache it for the case the conditions are not good to calculate it later but
 *  we will update it when they are.
 * 
 * const tC = ns.growthAnalyze(target, multiplier) / Math.log2(multiplier); // Same multiplier on both sides
 * We choose a multiplier like 1.0000000001 so it's easy that the theoretically multiplied
 *  money fits in the server.
 * 
 * With it we can calculate the money after growth this way:
 *   finalMoney = Math.floor(Math.pow(2, threads / TC) * (previousMoney + threads));
 */
let serverTC : any = {};

/** @param {NS} ns */
export function getHackingAdvice(ns : NS, target: string, threads: number) {
	// Server data
	let securityLevel = ns.getServerSecurityLevel(target);
	let minSecurity = ns.getServerMinSecurityLevel(target);
	let money = ns.getServerMoneyAvailable(target);
	let maxMoney = ns.getServerMaxMoney(target);
	let almostMaxMoney = maxMoney * 0.97;

	// Calc of server tC. See explanation above
	if (!serverTC[target] || (securityLevel == minSecurity)) {
		serverTC[target] = ns.growthAnalyze(target, 1.000000001) / Math.log2(1.000000001);
	}

	let threadsRemaining = threads;
	let advices = [];


	//// Advices

	// NOTE: You can remove those "time: ns.getSomethingTime(target)" to reduce RAM

	// First advice is weaken when needed
	if (threadsRemaining > 0 && securityLevel > minSecurity) {
		// Calc the needed threads too so you could grow something at the same time
		let th = Math.min(threadsRemaining, Math.ceil((securityLevel - minSecurity) * 20));
		threadsRemaining -= th;
		advices.push({ action: "weaken", threads: th, seconds: Math.ceil(ns.getWeakenTime(target) / 1000) });
	}

	// Second advice is grow
	if (threadsRemaining > 0 && money < almostMaxMoney) {
		let th = Math.min(threadsRemaining, Math.ceil(ns.growthAnalyze(target, maxMoney / (money + threadsRemaining))));
		threadsRemaining -= th;
		advices.push({ action: "grow", threads: th, seconds: Math.ceil(ns.getGrowTime(target) / 1000) });
	}

	// Third advice is hack
	let tC = serverTC[target];
	if (tC && threadsRemaining > 0 && money > 0) { // If money is 0 algorithm doesn't work
		/* 
		 * Hacking should be done with remaining threads unless that would lower the money too
		 *  much. Money should be kept high because otherwise it's much harder to grow back.
		 * 
		 * I belive we should be able to grow in one cycle the money we hack in one cycle.
		 */
		// let moneyWeCanHackTheoretically = Math.min(money, ns.hackAnalyze(target) * threadsRemaining * money);
		let maxGrowMultiplier = Math.pow(2, threads / tC);
		ns.print(`maxGrowMultiplier=${ns.formatNumber(maxGrowMultiplier)}`);
		/** If maxGrowMultiplier is 7, then we need to keep at least (1/7)*maxMoney safe to grow back in 1 cycle */
		let minMoneyTooKeepInServer = Math.ceil(maxMoney * (1 / maxGrowMultiplier));
		ns.print(`minMoneyTooKeepInServer=${ns.formatNumber(minMoneyTooKeepInServer)}`);
		let moneyWeCouldHack = Math.max(0, money - minMoneyTooKeepInServer);
		if (moneyWeCouldHack > 0) {
			ns.print(`moneyWeCouldHack=${ns.formatNumber(moneyWeCouldHack)}`);
			let th = Math.min(threadsRemaining,
				Math.floor(ns.hackAnalyzeThreads(target, moneyWeCouldHack))
			);
			if (th > 0) {
				advices.push({ action: "hack", threads: th, seconds: Math.ceil(ns.getHackTime(target) / 1000), moneyWeCouldHack });
			}
		} else {
			ns.print("We shouldn't hack");
		}
	}
	return advices;
}

/** @param {NS} ns */
export async function main(ns: NS) {
	let target = ns.args[0] as string;
	let threads = ns.args[1] as number;
	ns.clearLog();
	ns.tail();
	ns.print(`Hacking advice for ${target} with ${threads} threads is: ${JSON.stringify(getHackingAdvice(ns, target, threads))}`);
}