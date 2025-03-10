"use client";

import { useEffect, useRef } from "react";

export default function Viewer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    mediaSourceRef.current = new MediaSource();

    const WS_URL =
      `${process.env.NEXT_PUBLIC_WS_URL}` || "wss://your-backend-server.com";
    socketRef.current = new WebSocket(WS_URL);

    if (mediaSourceRef.current) {
      mediaSourceRef.current.addEventListener("sourceopen", () => {
        const sourceBuffer = mediaSourceRef.current?.addSourceBuffer(
          'video/webm; codecs="vp9"'
        );
        if (socketRef.current && sourceBuffer) {
          socketRef.current.onmessage = (event) => {
            sourceBuffer.appendBuffer(event.data);
          };
        }
      });
    }

    if (videoRef.current && mediaSourceRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);
    }

    socketRef.current.onopen = () =>
      console.log("✅ Connected to WebSocket:", WS_URL);
    socketRef.current.onerror = (err) =>
      console.error("❌ WebSocket Error:", err);
    socketRef.current.onclose = () => console.log("🔌 WebSocket Disconnected");

    return () => {
      socketRef.current?.close();
    };
  }, []);

  return (
    <div>
      <h1>🎥 Viewer</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", maxWidth: "800px" }}
      />
    </div>
  );
}
