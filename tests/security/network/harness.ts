import dns from "node:dns";
import net from "node:net";

export async function withNetworkDenied<T>(
  operation: () => Promise<T> | T,
): Promise<T> {
  const connect = net.Socket.prototype.connect;
  const lookup = dns.lookup;
  net.Socket.prototype.connect = function denied(): never {
    throw new Error("Unexpected network socket");
  } as typeof connect;
  dns.lookup = function deniedLookup(): never {
    throw new Error("Unexpected DNS attempt");
  } as typeof lookup;
  try {
    return await operation();
  } finally {
    net.Socket.prototype.connect = connect;
    dns.lookup = lookup;
  }
}
