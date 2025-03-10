"use client";

import { FC, useEffect, useRef, useState } from "react";

const MobileRecord: FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [cameraError, setCameraError] = useState<string>("");

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // WebSocket 연결 설정
      const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/stream`);

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          // ArrayBuffer로 변환하여 전송
          event.data.arrayBuffer().then((buffer) => {
            ws.send(buffer);
          });
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });

        // 녹화 완료 후 서버에 영상 업로드
        const formData = new FormData();
        formData.append("video", blob);

        try {
          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const { videoId } = await response.json();
            window.location.href = `/dolly-zoom/result/${videoId}`;
          }
        } catch (error) {
          console.error("Upload failed:", error);
        }
      };

      mediaRecorderRef.current.start(100); // 100ms 간격으로 데이터 전송
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      setCameraError(
        "Camera access denied. Please allow camera access and try again."
      );
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 text-white">
      <div className="relative h-full flex flex-col">
        <div className="flex-1 relative">
          {cameraError ? (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
              <p className="text-red-500">{cameraError}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>

        {/* Button container fixed to bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-6 space-y-4">
          {cameraError && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 rounded-full font-semibold text-lg bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg"
            >
              Retry Camera Access
            </button>
          )}
          {!cameraError && (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-4 rounded-full font-semibold text-lg ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              } transition-colors shadow-lg`}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileRecord;
