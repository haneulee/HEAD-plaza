"use client";

import { useEffect, useRef } from "react";

export default function Mobile() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 📌 WebSocket 주소를 환경변수에서 불러오기
    const WS_URL =
      process.env.NEXT_PUBLIC_WS_URL || "wss://your-backend-server.com";
    socketRef.current = new WebSocket(WS_URL);

    socketRef.current.onopen = () =>
      console.log("✅ Connected to WebSocket:", WS_URL);
    socketRef.current.onerror = (err) =>
      console.error("❌ WebSocket Error:", err);
    socketRef.current.onclose = () => console.log("🔌 WebSocket Disconnected");

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          socketRef.current?.send(event.data);
        }
      };

      mediaRecorder.start(100); // 100ms마다 전송
    });

    return () => {
      socketRef.current?.close();
    };
  }, []);

  return (
    <div>
      <h1>📹 Mobile Streaming</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", maxWidth: "500px" }}
      />
    </div>
  );
}
