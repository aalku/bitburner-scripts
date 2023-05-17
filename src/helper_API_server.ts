import { NS } from "@ns";
import { Transceiver, Message } from "Transceiver";
import { getHackingAdvice } from "HackingAdvice";

const PORT_REQUEST = 1;
const PORT_RESPONSE = 2;

/** 
 * @param {NS} ns
 * @param {any} msg
 * @returns {any}
 */
function work(ns: NS, msg: Message) {
	if (msg.data.order == "getHackingAdviceOnTarget") {
		let target = msg.data.target;
		let threads = msg.data.threads;

		let response = { advices: getHackingAdvice(ns, target, threads) };
		return response;
	} else {
		return { error: "Couldn't understand your order: " + JSON.stringify(msg.data, null, "  ") };
	}
}

/** @param {NS} ns */
export async function main(ns: NS) {
	/** @type {Transceiver} */
	const port = new Transceiver(ns, "HelperServer", PORT_RESPONSE, PORT_REQUEST);

	ns.clearLog();
	ns.tail();
	ns.atExit(() => {
		ns.print(`Communications statistics: ${JSON.stringify(port.getStatistics(), null, "  ")} }`);
	});
	let lmt = Date.now();
	while (true) {
		let msg = await port.receive();
		if (msg) {
			lmt = Date.now();
			ns.print(new Date().toISOString() + " - " + `Server received message: ${JSON.stringify(msg)}`);
			try {
				let response = work(ns, msg);
				await port.send(msg.source, response, msg.id);
			} catch (e) {
				ns.print("Helper API server error: " + e);
				ns.toast("Helper API server error: " + e, "error");
			}
		} else {
			// let forTime = lmt == null ? "infinite" : ns.tFormat(Date.now() - lmt);
			// ns.print(new Date().toISOString() + " - " + "No one talked to us for " + forTime);
		}
	}
}