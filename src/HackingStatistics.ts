import { NS } from "@ns";

class HackingStatistics {
  hackedMoney = 0;
  hackSuccessTimes = 0;
  hackFailTimes = 0;
  //
  firstHackTimestamp: number | null = null;
  lastHackTimestamp: number | null = null;
  lastHackResult: number | null = null;
  constructor({hackedMoney = 0, hackSuccessTimes = 0, hackFailTimes = 0, firstHackTimestamp = null, lastHackTimestamp = null, lastHackResult = null} = {}) {
    this.hackedMoney = hackedMoney;
    this.hackSuccessTimes = hackSuccessTimes;
    this.hackFailTimes = hackFailTimes;
    this.firstHackTimestamp = firstHackTimestamp;
    this.lastHackTimestamp = lastHackTimestamp;
    this.lastHackResult = lastHackResult;
  }

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
  constructor(globalStatistics: any = null, lastHackHacker: string | null = null) {
    console.log("globalStatistics", globalStatistics);
    this.globalStatistics = globalStatistics ? new HackingStatistics(globalStatistics) : new HackingStatistics();
    this.lastHackHacker = lastHackHacker;
  }
  // TODO per hacker statistics
  hackResult(hacker: string, result: number) {
    const ts = Date.now();
    this.lastHackHacker = hacker;
    this.globalStatistics.hackResult(hacker, result, ts);
  }
}

export class HackingStatisticsManager {
  getTargets() {
    const limit = Date.now() - 3 * 60 * 60 * 1000;
    return [...this._statistics.keys()].filter(t => {
      const s = this._statistics.get(t) as TargetStatistics;
      const recent = (s.globalStatistics.lastHackTimestamp || s.globalStatistics.firstHackTimestamp || 0) > limit;
      return recent;
    });
  }
  constructor(importDataObject = null) {
    if (importDataObject) {
      this.import(importDataObject, console.log);
    }
  }
  export() {
    return [...this._statistics.entries()].map((e) => ({ server: e[0], data: e[1] })); // TODO
  }
  import(plainObject: any, printFunction: Function = () => null) {
    printFunction(`debug: plainObject = ${JSON.stringify(plainObject)}`);
    const array = plainObject as { server: string, data: any }[];
    //printFunction(`debug: plainObject as array = ${JSON.stringify(array)}`);
    this._statistics.clear();
    for (const e of array) {
      const server = e.server;
      const data = e.data;
      const x = new TargetStatistics(data.globalStatistics, data.lastHackHacker);
      //printFunction(`  ${server}, ${JSON.stringify(x)}`);
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
    this.getTargetStatistics(target).hackResult(hacker, result);
  }

  getTargetStatistics(target: string) {
    let s = this._statistics.get(target);
    if (!s) {
      s = new TargetStatistics();
      this._statistics.set(target, s);
    }
    return s;
  }
}
