import { NS } from "@ns";
import { Transceiver } from "Transceiver";

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
		let msgId = await this.port.send("HelperServer", { order: "getHackingAdviceOnTarget", target, threads });
		if (!msgId) {
			throw "Timeout writing to port";
		} else {
			let msg = await this.port.receive(msgId);
			if (!msg) {
				throw "Timeout awaiting for server response";
			}
			if (msg.data.advices == undefined) {
				throw `Unknown answer format: ${JSON.stringify(msg.data, null, "  ")}`;
			}
			return msg.data.advices;
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
	ns.clearLog();
	ns.tail();

	let myName = `${ns.getHostname()} - ${ns.getScriptName()} - ${JSON.stringify([...ns.args])}`;
	let client = new HelperClient(ns, myName);

	ns.atExit(() => {
		// ns.print(`Statistics: ${JSON.stringify(client.port.getStatistics(), null, "  ")} }`);
	});


	let target = ns.args[0] as string;
	let threads = ns.args[1] as number;

	let advice = await client.getHackingAdvice(target, threads);

	ns.print(`Hacking advice received: ${JSON.stringify(advice, null, "  ")}`)
}