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
function work(ns: NS, msg: Message): any {
	if (msg.data.method == "getHackingAdviceOnTarget") {
		let target = msg.data.target;
		let threads = msg.data.threads;

		let response = { advices: getHackingAdvice(ns, target, threads) };
        ns.print(`response = ${JSON.stringify(response)}`);
		return response;
	} else if (msg.data.method == "reportTaskCompleted") {
        let task: any = msg.data.task;
        let result: any = msg.data.result;
        if (task.action == "hack") {
            if (result as number > 0) {
                ns.toast(`Hacked $${ns.formatNumber(result as number, 0, undefined, true)} from ${task.target}!!`, "success", 5000);
            } else {
                ns.toast(`Hacking ${task.target} failed!!`, "warning", 3000);
            }
        }
        return null;
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

    /** Received message. Null means not received or already processed */
    let msg: Message | null = null;
    /* If msg is not null it means it was being processed when aborted */
    ns.atExit(()=>{
        /* We try to unread a message being processed at exit so if the server is restarted then that message is not lost */
        if (msg != null) {
            port.tryUnread(msg);
        }
    });
	while (true) {
        msg = null; // <-- Important. See variable declaration.
        msg = await port.receive();
        if (msg) {
            lmt = Date.now();
            ns.print(new Date().toISOString() + " - " + `Server received message: ${JSON.stringify(msg)}`);
            try {
                let response = work(ns, msg);
                if (response) {
                    await port.send(msg.source, response, msg.id);
                }
            } catch (e) {
                ns.print("Helper API server error: " + e);
                ns.toast("Helper API server error: " + e, "error");
                await new Promise((r) => setTimeout(r, 1));
            }
        } else {
            // let forTime = lmt == null ? "infinite" : ns.tFormat(Date.now() - lmt);
            // ns.print(new Date().toISOString() + " - " + "No one talked to us for " + forTime);
        }
	}
}