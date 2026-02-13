import { NextRequest, NextResponse } from "next/server";
import { getPusherServer } from "@/lib/pusher-server";

export async function POST(req: NextRequest) {
  const data = await req.text();
  const params = new URLSearchParams(data);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const pusher = getPusherServer();
  const auth = pusher.authorizeChannel(socketId, channelName);

  return NextResponse.json(auth);
}
