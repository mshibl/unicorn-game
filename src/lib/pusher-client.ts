import PusherClient from "pusher-js";

let pusherClientInstance: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!pusherClientInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2";
    if (!key) {
      throw new Error(
        "Missing NEXT_PUBLIC_PUSHER_KEY. Add it to .env.local for real-time features."
      );
    }
    pusherClientInstance = new PusherClient(key, { cluster });
  }
  return pusherClientInstance;
}
