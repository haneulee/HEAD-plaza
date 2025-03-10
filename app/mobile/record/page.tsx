"use client";

import { useEffect, useRef, useState } from "react";

import io from "socket.io-client";

export default function Mobile() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<any>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    // 웹소켓 연결
    socketRef.current = io(process.env.SIGNALING_SERVER);

    // PeerConnection 생성
    peerRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (peerRef.current) {
      peerRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("candidate", event.candidate);
        }
      };

      peerRef.current.onnegotiationneeded = async () => {
        if (!peerRef.current) return;
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socketRef.current?.emit("offer", offer);
      };
    }

    socketRef.current.on(
      "answer",
      async (answer: RTCSessionDescriptionInit) => {
        await peerRef.current?.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    );

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  const startStreaming = async () => {
    if (!peerRef.current || !videoRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    videoRef.current.srcObject = stream;
    stream
      .getTracks()
      .forEach((track) => peerRef.current?.addTrack(track, stream));
    setStreaming(true);
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>📹 Mobile Camera Streaming</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", maxWidth: "500px" }}
      />
      {!streaming && <button onClick={startStreaming}>Start Streaming</button>}
    </div>
  );
}
