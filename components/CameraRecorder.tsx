"use client";

import { useRef, useState } from "react";

import { QRCodeSVG } from "qrcode.react";

const CameraRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [qrCodeData, setQRCodeData] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        const url = URL.createObjectURL(blob);
        setVideoURL(url);
        setQRCodeData(generateShareableURL(url));
        recordedChunksRef.current = [];
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    }
  };

  const generateShareableURL = (videoURL: string) => {
    // 실제 배포된 도메인으로 변경해야 합니다
    const baseURL = window.location.origin;
    return `${baseURL}/dolly-zoom/result?video=${encodeURIComponent(videoURL)}`;
  };

  return (
    <div className="w-full h-full flex flex-col">
      {videoURL ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 p-6">
          <h2 className="text-2xl font-bold text-white mb-6">
            Recording Complete!
          </h2>
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <QRCodeSVG
              value={qrCodeData || ""}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          <p className="text-gray-300 mt-4 text-center">
            Scan the QR code to view your dolly zoom attempt
            <br />
            and learn more about the technique
          </p>
          <button
            onClick={() => {
              setVideoURL(null);
              setQRCodeData(null);
            }}
            className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
          >
            Record Another Take
          </button>
        </div>
      ) : (
        <div className="w-full h-full relative">
          <video
            ref={videoRef}
            autoPlay
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`px-6 py-2 rounded-full font-semibold ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              } text-white transition-colors`}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraRecorder;
