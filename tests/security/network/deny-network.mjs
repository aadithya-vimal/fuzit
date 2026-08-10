import dns from "node:dns";
import net from "node:net";

net.Socket.prototype.connect = function denied() {
  throw new Error("Unexpected network socket in network-denied child process");
};
dns.lookup = function deniedLookup() {
  throw new Error("Unexpected DNS attempt in network-denied child process");
};
