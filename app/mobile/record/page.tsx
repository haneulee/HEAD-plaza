"use client";

import { useEffect, useRef, useState } from "react";

export default function Mobile() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // WebSocket 연결 시도
    const connectWebSocket = () => {
      const WS_URL =
        process.env.NEXT_PUBLIC_WS_URL || "wss://your-backend-server.com/ws";

      // 이미 연결된 소켓이 있으면 닫기
      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        socketRef.current.close();
      }

      // 새 WebSocket 연결 생성
      socketRef.current = new WebSocket(WS_URL);

      socketRef.current.onopen = () => {
        console.log("✅ Connected to WebSocket:", WS_URL);
        setIsConnected(true);
        setError(null);

        // 연결 성공 후 카메라 스트림 시작
        startCameraStream();
      };

      socketRef.current.onerror = (err) => {
        console.error("❌ WebSocket Error:", err);
        setError("WebSocket 연결 오류가 발생했습니다.");
        setIsConnected(false);
      };

      socketRef.current.onclose = () => {
        console.log("🔌 WebSocket Disconnected");
        setIsConnected(false);
      };
    };

    // 카메라 스트림 시작 함수
    const startCameraStream = () => {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }

          // WebSocket이 열려있는지 확인
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: "video/webm",
            });

            mediaRecorder.ondataavailable = (event) => {
              if (
                event.data.size > 0 &&
                socketRef.current?.readyState === WebSocket.OPEN
              ) {
                socketRef.current.send(event.data);
              }
            };

            mediaRecorder.start(100); // 100ms마다 전송
          } else {
            setError("WebSocket이 연결되지 않았습니다. 다시 시도해주세요.");
          }
        })
        .catch((err) => {
          console.error("카메라 접근 오류:", err);
          setError("카메라에 접근할 수 없습니다.");
        });
    };

    // 초기 연결 시도
    connectWebSocket();

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }

      // 카메라 스트림 정리
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 재연결 시도 함수
  const handleRetry = () => {
    setError(null);
    // WebSocket 재연결
    if (socketRef.current) {
      socketRef.current.close();
    }

    const WS_URL =
      process.env.NEXT_PUBLIC_WS_URL || "wss://your-backend-server.com/ws";
    socketRef.current = new WebSocket(WS_URL);

    // 이벤트 핸들러 다시 설정
    // ... (위와 동일한 이벤트 핸들러)
  };

  return (
    <div className="fixed inset-0 bg-gray-900 text-white flex flex-col">
      <div className="p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">📹 Mobile Streaming</h1>
        <p
          className={`text-sm ${
            isConnected ? "text-green-500" : "text-red-500"
          }`}
        >
          {isConnected ? "연결됨" : "연결 안됨"}
        </p>
      </div>

      <div className="flex-1 relative">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
            <div className="bg-red-900 p-4 rounded-lg max-w-xs text-center">
              <p className="mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="bg-white text-red-900 px-4 py-2 rounded font-bold"
              >
                다시 시도
              </button>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
