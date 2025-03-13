"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { InfoPopup } from "@/components/InfoPopup";
import { QRCodeSVG } from "qrcode.react";
import Webcam from "react-webcam";

const MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

const DollyTest = () => {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.5);

  // 웹캠 설정
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };

  const startRecording = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (!webcamRef.current?.video?.srcObject) {
      console.error("No webcam stream available");
      setIsProcessing(false);
      return;
    }

    recordedChunksRef.current = [];
    const stream = webcamRef.current.video.srcObject as MediaStream;

    // 지원되는 MIME 타입 확인
    let mimeType = "";
    for (const type of MIME_TYPES) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    try {
      console.log("Starting recording with mime type:", mimeType);
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        // console.log("Data available, size:", event.data?.size);
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("Recording stopped, processing...");
        handleRecordingStop();
      };

      // 100ms마다 데이터 수집
      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      console.log("Recording started");
      setIsProcessing(false);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert(
        "녹화를 시작할 수 없습니다. 브라우저가 이 기능을 지원하지 않을 수 있습니다."
      );
      setIsProcessing(false);
    }
  }, [isProcessing]);

  const stopRecording = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);

    console.log("Stopping recording...");

    if (!mediaRecorderRef.current) {
      console.error("No MediaRecorder instance found");
      setIsProcessing(false);
      return;
    }

    try {
      const recorderState = mediaRecorderRef.current.state;
      console.log("Current recorder state:", recorderState);

      if (recorderState === "inactive") {
        console.log("MediaRecorder already inactive");
        setIsRecording(false);
        setIsProcessing(false);
        return;
      }

      // 즉시 녹화 상태 업데이트 (UI 반응성 향상)
      setIsRecording(false);

      // 마지막 데이터 조각을 강제로 수집
      console.log("Requesting final data chunk...");
      mediaRecorderRef.current.requestData();

      // 즉시 중지 시도
      try {
        console.log("Stopping MediaRecorder immediately...");
        mediaRecorderRef.current.stop();
      } catch (stopErr) {
        console.error("Error stopping MediaRecorder:", stopErr);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Error in stopRecording:", err);
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, [isProcessing]);

  const handleRecordingStop = async () => {
    const chunks = recordedChunksRef.current;
    console.log("Processing recording, chunks:", chunks.length);

    if (chunks.length === 0) {
      console.error("No recorded data");
      alert("녹화된 데이터가 없습니다. 다시 시도해주세요.");
      setIsProcessing(false);
      return;
    }

    try {
      // 청크 정보 로깅
      chunks.forEach((chunk, index) => {
        console.log(`Chunk ${index}: ${chunk.size} bytes, type: ${chunk.type}`);
      });

      // Blob 생성
      const blobType = chunks[0].type || "video/webm";
      const blob = new Blob(chunks, { type: blobType });
      console.log("Created blob:", blob.size, "bytes, type:", blob.type);

      if (blob.size > 0) {
        await uploadToCloudinary(blob);
      } else {
        console.error("Empty blob created");
        alert("녹화된 데이터가 없습니다. 다시 시도해주세요.");
      }
    } catch (err) {
      console.error("Error processing recording:", err);
      alert("녹화 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  const uploadToCloudinary = async (blob: Blob) => {
    setUploadStatus("uploading");
    console.log("Uploading to Cloudinary...");

    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "your_cloud_name";
    const uploadPreset =
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "your_preset";

    try {
      const formData = new FormData();
      formData.append("file", blob, `recording-${Date.now()}.webm`);
      formData.append("upload_preset", uploadPreset);
      formData.append("resource_type", "video");

      console.log("Sending upload request...");
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      console.log("Cloudinary response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Cloudinary error:", errorText);
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("Upload successful:", data);

      if (!data.secure_url) {
        throw new Error("No secure URL in response");
      }

      setVideoUrl(data.secure_url);
      setUploadStatus("success");
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      setUploadStatus("error");
      alert("비디오 업로드에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 시작 버튼 핸들러
  const handleStartButton = () => {
    if (isProcessing) return;

    if (showInstructions) {
      setShowInstructions(false);
      console.log("Instructions hidden, starting recording");

      // 약간의 지연 후 녹화 시작
      setTimeout(() => {
        startRecording();
      }, 500);
    } else if (!isRecording && !videoUrl) {
      startRecording();
    }
  };

  // 중지 버튼 핸들러
  const handleStopButton = () => {
    if (isProcessing) return;

    if (isRecording) {
      stopRecording();
    }
  };

  // 새 녹화 버튼 핸들러
  const handleNewRecordingButton = () => {
    if (isProcessing) return;
    setVideoUrl(null);
  };

  // 컴포넌트 마운트 시 실행
  useEffect(() => {
    console.log("Component mounted");

    return () => {
      console.log("Component unmounting");

      // 녹화 중이면 중지
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive" &&
        document.visibilityState !== "hidden"
      ) {
        try {
          console.log("Stopping MediaRecorder on unmount");
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error("Error stopping MediaRecorder on unmount:", e);
        }
      }
    };
  }, []);

  // 웹캠 에러 핸들러
  const handleWebcamError = useCallback((err: string | DOMException) => {
    console.error("Webcam error:", err);
    setCameraError(typeof err === "string" ? err : err.message);
  }, []);

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const normalizedX = e.clientX / window.innerWidth;
    // 마우스 x 좌표가 작을수록 줌아웃(1.5), 클수록 줌인(4.5)
    const newZoomLevel = 1.5 + normalizedX * 3.0; // 1.5에서 시작해서 4.5까지 증가
    setZoomLevel(newZoomLevel);
  }, []);

  return (
    <div
      className="flex flex-col h-screen bg-black text-white"
      onMouseMove={handleMouseMove}
    >
      <button
        onClick={() => setIsInfoOpen(true)}
        className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg hover:bg-opacity-70 z-10"
      >
        <span className="text-2xl">🍿</span>
      </button>
      <InfoPopup isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />

      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Dolly Zoom Effect 🎥</h1>
        <p className="text-gray-300 max-w-3xl">
          The Dolly Zoom is a cinematic technique where the camera physically
          moves towards or away from a subject while simultaneously zooming in
          the opposite direction. This creates a dramatic effect where the
          subject remains the same size while the background appears to change
          in perspective.
        </p>
      </div>

      <div className="flex flex-1 px-8 pb-8">
        <div className="w-1/2 pr-4 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">
            Dolly Zoom Shot: Jaws 🦈{" "}
          </h2>
          <div className="aspect-video flex-shrink-0 mb-4">
            <video
              className="w-full h-full rounded-lg object-cover"
              autoPlay
              loop
              muted
              playsInline
              src="/sample/dolly zoom - jaws.mov"
              onLoadedMetadata={(e) => {
                e.currentTarget.playbackRate = 0.5;
              }}
            />
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h3 className="text-lg font-semibold mb-2">
              How to create your own:
            </h3>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside">
              <li>Start recording on the phone camera</li>
              <li>
                Move the camera towards or away from the subject while
                simultaneously zooming in or out
              </li>
              <li>Keep your subject centered and the same size</li>
              <li>Stop recording when done</li>
            </ol>
          </div>
        </div>

        <div className="w-1/2 pl-4 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">
            {showInstructions
              ? "Click Start to begin recording"
              : isRecording
              ? "Recording... Click Stop when finished"
              : videoUrl
              ? "Your Dolly Zoom Effect"
              : "Camera Preview (Click Start to record)"}
          </h2>

          <div className="aspect-video flex-shrink-0 relative flex items-center justify-center">
            <div
              className={`absolute w-full h-full overflow-hidden ${
                showInstructions || videoUrl ? "hidden" : ""
              }`}
            >
              <Webcam
                audio={true}
                ref={webcamRef}
                videoConstraints={videoConstraints}
                onUserMediaError={handleWebcamError}
                className="rounded-lg w-full h-full object-cover"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: "transform 10ms ease-out",
                }}
              />
            </div>

            {/* 녹화 중 표시기 */}
            {isRecording && (
              <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full animate-pulse z-10">
                REC
              </div>
            )}

            {/* 안내 화면 */}
            {showInstructions && (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg border border-gray-700 w-full h-full">
                <h3 className="text-xl font-semibold mb-4">Instructions</h3>
                <ol className="text-gray-300 space-y-2 list-decimal list-inside mb-6">
                  <li>Click Start to begin camera and recording</li>
                  <li>Create your Dolly Zoom effect</li>
                  <li>Click Stop when finished</li>
                  <li>Your video will be automatically uploaded</li>
                </ol>
                <button
                  onClick={handleStartButton}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-semibold disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Start Recording"}
                </button>
              </div>
            )}

            {/* 비디오 URL이 있을 때 QR 코드 표시 */}
            {videoUrl && (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg border border-gray-700 w-full h-full">
                <div className="bg-white p-4 rounded-lg mb-4">
                  <QRCodeSVG value={videoUrl} size={200} level="H" />
                </div>
                <p className="text-gray-300 mb-2">
                  Scan the QR code to view your video
                </p>
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Or click here to view directly
                </a>
                <button
                  onClick={handleNewRecordingButton}
                  disabled={isProcessing}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  {isProcessing ? "Processing..." : "Record Another"}
                </button>
              </div>
            )}

            {/* 업로드 중 표시 */}
            {uploadStatus === "uploading" && (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg border border-gray-700 w-full h-full">
                <p className="text-gray-300">
                  Uploading your video... Please wait.
                </p>
              </div>
            )}

            {/* 카메라 오류 표시 */}
            {cameraError && !showInstructions && !videoUrl && (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg border border-gray-700 w-full h-full">
                <p className="text-gray-300 mb-4">
                  {cameraError ||
                    "카메라를 사용할 수 없습니다. 카메라 권한을 확인해주세요."}
                </p>
                <button
                  onClick={() => {
                    setCameraError(null);
                    // 웹캠 컴포넌트는 자동으로 다시 시도합니다
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  카메라 다시 시도
                </button>
              </div>
            )}

            {/* 녹화 제어 버튼 */}
            {!showInstructions && !videoUrl && !cameraError && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                {!isRecording ? (
                  <button
                    onClick={handleStartButton}
                    disabled={isProcessing}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
                  >
                    {isProcessing ? "Processing..." : "Start Recording"}
                  </button>
                ) : (
                  <button
                    onClick={handleStopButton}
                    disabled={isProcessing}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50"
                  >
                    {isProcessing ? "Processing..." : "Stop Recording"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DollyTest;
