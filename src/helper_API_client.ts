import { NS } from "@ns";
import { Transceiver } from "Transceiver";
import { HackingStatisticsManager } from "HackingStatistics";

/**
 * @param {NS} ns
 */
export class HelperClient {
	ns: NS;
	port: Transceiver;

	/**
	 * @param {NS} ns
	 * @param {string} uniqueName Optinal, must identify the client uniquely across all the network
	 */
	constructor(ns: NS, uniqueName: string) {
		/**
		 * @type {NS} ns
		 */
		this.ns = ns;
		if (!uniqueName) {
			uniqueName = `${ns.getScriptName()} - ${Math.ceil(Math.random() * 1000000)}`;
		}
		const PORT_REQUEST = 1;
		const PORT_RESPONSE = 2;
		/** @type { Transceiver } */
		this.port = new Transceiver(ns, uniqueName, PORT_REQUEST, PORT_RESPONSE);
	}
	async getHackingAdvice(target: string, threads: number) {
		let msgId = await this.port.send("HelperServer", { method: "getHackingAdviceOnTarget", target, threads });
		if (!msgId) {
			throw "Timeout writing to port";
		} else {
			let msg = await this.port.receive(msgId);
			if (!msg) {
				throw "Timeout awaiting for server response";
			}
			if (msg.data?.advices == undefined) {
				throw `Unknown answer format: ${JSON.stringify(msg.data, null, "  ")}`;
			}
			return msg.data?.advices;
		}
	}
	async reportTaskCompleted(task: any, result: any) {
		this.port.send("HelperServer", { method: "reportTaskCompleted", task, result });
	}
	async getHackingStatistics() {
		let msgId = await this.port.send("HelperServer", { method: "getHackingStatistics" });
		if (!msgId) {
			throw "Timeout writing to port";
		} else {
			let msg = await this.port.receive(msgId);
			if (!msg) {
				throw "Timeout awaiting for server response";
			}
			return msg.data?.statistics;
		}
	}
}

/** 
 * HelperClient should be imported from other script and used that way
 * 
 * This main(ns) is just an example. You can delete it. It consumes 0.05GB.
 * 
 * @param {NS} ns
 */
export async function main(ns: NS): Promise<void> {

	let myName = `${ns.getHostname()} - ${ns.getScriptName()} - ${JSON.stringify([...ns.args])}`;
	let client = new HelperClient(ns, myName);

	ns.atExit(() => {
		// ns.print(`Statistics: ${JSON.stringify(client.port.getStatistics(), null, "  ")} }`);
		// ns.tail();
	});

	let order = ns.args[0] as string;

	if (order == "hackingAdvice") {
		let target = ns.args[1] as string;
		let threads = ns.args[2] as number;

		let advice = await client.getHackingAdvice(target, threads);

		ns.tprint(`Hacking advice received: ${JSON.stringify(advice, null, "  ")}`)
	} else if (order == "hackingStatistics") {
		let statistics = new HackingStatisticsManager(await client.getHackingStatistics());
		// ns.tprint(`Hacking statistics received: ${JSON.stringify(statistics.export(), null, "  ")}`)
		const text = [];
		const alerts = [];
		let moneyPerSecondTotal: number = 0;
		const ts = Date.now();
		for (const target of statistics.getTargets()) {
			const targetStatistics = statistics.getTargetStatistics(target);
			const tgs = targetStatistics.globalStatistics;
			const duration = (tgs.firstHackTimestamp && ts) ? (ts - tgs.firstHackTimestamp) : null;
			const hackAttempts = tgs.hackSuccessTimes + tgs.hackFailTimes;
			let obj;
            if (duration && hackAttempts) {
				const avgTimeBetweenHackAttempts = (hackAttempts > 1) ? duration / (hackAttempts - 1) : null;
				const durationAdjusted = duration + (avgTimeBetweenHackAttempts  || 0);
				const moneyPerSecond: number = tgs.hackedMoney / durationAdjusted * 1000;
				const timeSinceLastHackAttempt = tgs.lastHackTimestamp ? Date.now() - tgs.lastHackTimestamp : null;
				moneyPerSecondTotal += moneyPerSecond || 0;
				obj = {
					moneyPerSecond: tgs.hackSuccessTimes ? `$${moneyPerSecond ? ns.formatNumber(moneyPerSecond, 1) : null}` : null,
					totalHackedMoney: `$${ns.formatNumber(tgs.hackedMoney, 1)}`,
					totalHackedMoneyPerSuccess: tgs.hackSuccessTimes ? `$${ns.formatNumber(tgs.hackedMoney / tgs.hackSuccessTimes, 1)}` : null,
					avgTimeBetweenHackAttempts: `${avgTimeBetweenHackAttempts ? ns.tFormat(avgTimeBetweenHackAttempts) : null}`,
					hacksAttempted: `${ns.formatNumber(hackAttempts, 0)}`,
					hackSuccesses: `${ns.formatPercent(tgs.hackSuccessTimes / (tgs.hackSuccessTimes + tgs.hackFailTimes), 0)}`,
					totalDuration: `${duration ? ns.tFormat(duration) : null}`,
					lastHackResult: `$${tgs.lastHackResult ? ns.formatNumber(tgs.lastHackResult, 1) : null}`,
					lastHackHacker: targetStatistics.lastHackHacker,
				};
				if (timeSinceLastHackAttempt && avgTimeBetweenHackAttempts && timeSinceLastHackAttempt > avgTimeBetweenHackAttempts) {
					alerts.push(`Alarm at ${target}: Expected one hack attempt every ${ns.tFormat(avgTimeBetweenHackAttempts)} but last was ${ns.tFormat(timeSinceLastHackAttempt)} ago`);
				}
			} else {
				obj = {};
			}
			text.push(`${target}:  ${JSON.stringify(obj, null, "    ")}`);
		}
		text.push(`moneyPerSecondTotal: $${ns.formatNumber(moneyPerSecondTotal, 1)}`)
		text.push(`moneyPerHourTotal:   $${ns.formatNumber(moneyPerSecondTotal * 60 * 60, 1)}`)
		text.push(`moneyPerDayTotal:    $${ns.formatNumber(moneyPerSecondTotal * 60 * 60 * 24, 1)}`)
		if (alerts) {
			text.push("Alerts:");
			for (const a of alerts) {
				text.push(`  ${a}`);
			}
		}
		ns.tprint("...\r\n" + text.join("\r\n"));
	} else if (order == "hackingStatisticsRaw") {
		let statistics = new HackingStatisticsManager(await client.getHackingStatistics());
		ns.tprint(`Hacking statistics received: \r\n${JSON.stringify(statistics.export(), null, "  ")}`)
	}

}