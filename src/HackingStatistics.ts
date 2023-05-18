import { NS } from "@ns";

class HackingStatistics {
  hackedMoney = 0;
  hackSuccessTimes = 0;
  hackFailTimes = 0;
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
  export() {
    return [...this._statistics.entries()].map((e) => ({ server: e[0], data: e[1] })); // TODO
  }
  import(plainObject: Object) {
    return; // TODO
    const array = plainObject as {server: string, data: any}[];
    this._statistics.clear();
    for (const e of array) {
      const server = e.server;
      const data = e.data;
      const x = data as TargetStatistics;
      this._statistics.set(server, x);
    }
  }
  static instance = new HackingStatisticsManager();
  _statistics = new Map<string, TargetStatistics>();
  /**
   *
   * @param hacker {string} Hacker server
   * @param target {string} Hacked server
   * @param result {number} Hacking result ($, 0=fail)
   */
  hackResult(hacker: string, target: string, result: number) {
    this._getTargetStatistics(target).hackResult(hacker, result);
  }

  _getTargetStatistics(target: string) {
    let s = this._statistics.get(target);
    if (!s) {
      s = new TargetStatistics();
      this._statistics.set(target, s);
    }
    return s;
  }
}
