"use client";

import { useEffect, useRef, useState } from "react";

import io from "socket.io-client";

export default function Mobile() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<any>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [streaming, setStreaming] = useState(false);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    // 웹소켓 연결
    socketRef.current = io(process.env.NEXT_PUBLIC_API_URL);

    // 연결 상태 로깅
    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server");
    });

    socketRef.current.on("connect_error", (err: any) => {
      console.error("Connection error:", err);
    });

    // PeerConnection 생성
    peerRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (peerRef.current) {
      peerRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate");
          socketRef.current?.emit("candidate", event.candidate);
        }
      };
    }

    // 저장된 ICE candidate 처리 함수
    const processIceCandidates = () => {
      if (peerRef.current?.remoteDescription) {
        iceCandidatesQueue.current.forEach((candidate) => {
          peerRef.current
            ?.addIceCandidate(new RTCIceCandidate(candidate))
            .catch((e) =>
              console.error("Error adding queued ICE candidate:", e)
            );
        });
        iceCandidatesQueue.current = [];
      }
    };

    socketRef.current.on(
      "answer",
      async (answer: RTCSessionDescriptionInit) => {
        console.log("Received answer from viewer");
        if (peerRef.current) {
          try {
            await peerRef.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
            console.log("Remote description set successfully");

            // 원격 설명이 설정된 후 저장된 ICE candidate 처리
            processIceCandidates();
          } catch (error) {
            console.error("Error setting remote description:", error);
          }
        }
      }
    );

    socketRef.current.on(
      "candidate",
      async (candidate: RTCIceCandidateInit) => {
        console.log("Received ICE candidate from viewer");
        if (peerRef.current) {
          if (peerRef.current.remoteDescription) {
            try {
              await peerRef.current.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            } catch (error) {
              console.error("Error adding ICE candidate:", error);
            }
          } else {
            // 원격 설명이 아직 설정되지 않았으면 큐에 저장
            console.log("Queueing ICE candidate");
            iceCandidatesQueue.current.push(candidate);
          }
        }
      }
    );

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const startStreaming = async () => {
    if (!peerRef.current || !videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      videoRef.current.srcObject = stream;

      stream.getTracks().forEach((track) => {
        peerRef.current?.addTrack(track, stream);
      });

      // 스트림 추가 후 협상 시작
      if (peerRef.current) {
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        console.log("Sending offer");
        socketRef.current?.emit("offer", offer);
      }

      setStreaming(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 text-white">
      <div className="relative h-full flex flex-col">
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-6">
          {!streaming ? (
            <button
              onClick={startStreaming}
              className="w-full py-4 rounded-full font-semibold text-lg bg-green-600 hover:bg-green-700 transition-colors shadow-lg"
            >
              Start Streaming
            </button>
          ) : (
            <div className="text-center text-white">
              Streaming... Open desktop view to see your camera
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
