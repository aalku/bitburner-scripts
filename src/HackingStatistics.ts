import { NS } from "@ns";

class HackingStatistics {
    hackedMoney: number = 0;
    hackSuccessTimes: number = 0;
    hackFailTimes: number = 0;
    //
    firstHackTimestamp: number | null = null;
    lastHackTimestamp: number | null = null;
    lastHackResult: number | null = null;
    hackResult(hacker: string, result: number, timestamp: number) {
        if (this.firstHackTimestamp == null) {
            this.firstHackTimestamp = timestamp;
        }
        this.lastHackTimestamp = timestamp;
        this.lastHackResult = result;
        if (result > 0) {
            this.hackSuccessTimes++;
            this.hackedMoney += result;
        } else {
            this.hackFailTimes++;
        }
    }
}
class TargetStatistics {
    globalStatistics = new HackingStatistics();
    lastHackHacker: string | null = null;
    // TODO per hacker statistics
    hackResult(hacker: string, result: number) {
        const ts = Date.now();
        this.lastHackHacker = hacker;
        this.globalStatistics.hackResult(hacker, result, ts);
    }
}

export class HackingStatisticsManager {
    static instance = new HackingStatisticsManager();
    _statistics = new Map<String, TargetStatistics>();
    /**
     * 
     * @param hacker {string} Hacker server
     * @param target {string} Hacked server
     * @param result {number} Hacking result ($, 0=fail)
     */
    hackResult(hacker: string, target: string, result: number) {
        this._getTargetStatistics(target).hackResult(hacker, result);
    }

    _getTargetStatistics(target: String) {
        let s = this._statistics.get(target);
        if (!s) {
            s = new TargetStatistics();
            this._statistics.set(target, s);
        }
        return s;
    }
}