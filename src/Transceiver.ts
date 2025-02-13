/* eslint-disable no-constant-condition */
import { NS, NetscriptPort } from "@ns";

const TIMEOUT_SECONDS = 10;
export class Message {
  source: string;
  target: string;
  data: any;
  id: number | null;
  timeout: number | null;

  /** @constructor
   * @param {string} source
   * @param {string} target
   * @param {any} data
   */
  constructor(
    source: string,
    target: string,
    data: unknown,
    id: number | null = null,
    timeout: number | null = null
  ) {
    this.source = source;
    this.target = target;
    this.data = data;
    this.id = id || 1000000001 + Math.floor(Math.random() * 1000000000);
    this.timeout = timeout || Date.now() + TIMEOUT_SECONDS * 1000;
  }
  /** @returns {Message} */
  static parse(smsg: string): Message {
    const x = JSON.parse(smsg);
    function p({ source, target, data, id, timeout }: any): Message {
      return new Message(source, target, data, id, timeout);
    }
    const x2 = p(x);
    return x2;
  }
  isTimedOut(now = Date.now()) {
    return this.timeout && now > this.timeout;
  }
}
export class Transceiver {

  ns: NS;
  source: string;
  tx: NetscriptPort;
  rx: NetscriptPort;
  messagesSent: number;
  messagesReceived: number;
  resendAtRxCount: number;
  resendAtRxFailedCount: number;
  retrySendCount: number;
  timeoutsSending: number;
  timeoutsReceiving: number;
  foundTimedOutMessagesOnRx: number;
  nullPortData: number;

  getStatistics: () => {
    messagesSent: number;
    messagesReceived: number;
    resendAtRxCount: number;
    resendAtRxFailedCount: number;
    retrySendCount: number;
    timeoutsSending: number;
    timeoutsReceiving: number;
    foundTimedOutMessagesOnRx: number;
    nullPortData: number;
  };

  /** @constructor
   * @param {NS} ns
   * @param {string} source
   * @param {number} rx
   * @param {number} tx
   */
  constructor(ns: NS, source: string, tx: number, rx: number) {
    this.ns = ns;
    this.source = source;
    /** @type {NetscriptPort} */
    this.tx = ns.getPortHandle(tx);
    /** @type {NetscriptPort} */
    this.rx = ns.getPortHandle(rx);
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.resendAtRxCount = 0;
    this.resendAtRxFailedCount = 0;
    this.retrySendCount = 0;
    this.timeoutsSending = 0;
    this.timeoutsReceiving = 0;
    this.foundTimedOutMessagesOnRx = 0;
    this.timeoutsReceiving = 0;
    this.nullPortData = 0;
    this.getStatistics = () => {
      return {
        messagesSent: this.messagesSent,
        messagesReceived: this.messagesReceived,
        resendAtRxCount: this.resendAtRxCount,
        resendAtRxFailedCount: this.resendAtRxFailedCount,
        retrySendCount: this.retrySendCount,
        timeoutsSending: this.timeoutsSending,
        timeoutsReceiving: this.timeoutsReceiving,
        foundTimedOutMessagesOnRx: this.foundTimedOutMessagesOnRx,
        nullPortData: this.nullPortData,
      };
    };
  }

  async waitForData(timeoutMillis = -1) {
    if (timeoutMillis <= 0) {
      throw `timeoutMillis must be > 0`;
    }
    return new Promise((resolve) => {
      setTimeout(resolve, timeoutMillis);
      this.rx.nextWrite().then(resolve);
    });
  }

  /**
   *
   * Tries to send a message to a target and will return
   *  msgId if sent but that doesn't prove it was received.
   *
   * @method
   * @param {string} target
   * @param {any} data
   * @return {Promise<number>}
   */
  async send(target: string, data: unknown, id: number | null = null): Promise<number | null> {
    const msg = new Message(this.source, target, data, id);
    const smsg = JSON.stringify(msg);
    while (true) {
      const res = this.tx.tryWrite(smsg);
      if (res) {
        this.messagesSent++;
        return msg.id;
      } else {
        if (msg.isTimedOut()) {
          this.timeoutsSending++;
          return null;
        }
        this.retrySendCount++;
        await new Promise((r) => setTimeout(r, 10));
      }
    }
  }

  /**
   * @param {number} msgId
   * @return {Promise<Message>}
   */
  async receive(msgId: number | null = null, timeoutMillis = TIMEOUT_SECONDS * 1000): Promise<Message | null> {
    const tO = Date.now() + timeoutMillis;
    while (true) {
      let smsg: string;
      while (true) {
        smsg = this.rx.read() as string;
        if (smsg == "NULL PORT DATA") {
          this.nullPortData++;
          const dt = tO - Date.now();
          if (dt <= 0) {
            this.timeoutsReceiving++;
            return null;
          } else {
            await this.waitForData(Math.min(50, dt));
          }
        } else {
          break;
        }
      }

      /** @type {Message} */
      const msg: Message = Message.parse(smsg);
      if ((msgId && msgId != msg.id) || msg.target != this.source) {
        // Resend mismatched message
        this.resendAtRxCount++;
        while (!msg.isTimedOut()) {
          const wasEmpty = this.rx.empty();
          const res = this.rx.tryWrite(smsg);
          if (res) {
            if (wasEmpty) {
              // We have to wait so we don't read the same message again ourselves
              await new Promise((r) => setTimeout(r, 50 + 1));
            } else {
              // We have to wait too because there might be several messages and none for us
              await new Promise((r) => setTimeout(r, 1));
            }
            break;
          }
          this.resendAtRxFailedCount++;
          await new Promise((r) => setTimeout(r, 10));
        }
      } else if (msg.isTimedOut()) {
        this.foundTimedOutMessagesOnRx++;
      } else {
        this.messagesReceived++;
        // this.ns.print(new Date().toISOString() + " - " + `Received message: ${JSON.stringify(msg)}`);
        return msg;
      }
    }
  }

  tryUnread(msg: Message) {
    const smsg = JSON.stringify(msg);
    return this.rx.tryWrite(smsg);
  }

}
