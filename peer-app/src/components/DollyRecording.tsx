import { useEffect, useRef, useState } from "react";

interface Props {
  onRecordingComplete: (videoUrl: string) => void;
}

export const DollyRecording = ({ onRecordingComplete }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [progress, setProgress] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUploadingRef = useRef<boolean>(false);

  // 웹캠 설정을 처음 한 번만 실행
  useEffect(() => {
    let stream: MediaStream;

    const setupWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;

          // 녹화 설정
          const mediaRecorder = new MediaRecorder(stream);
          const chunks: BlobPart[] = [];

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              chunks.push(e.data);
            }
          };

          mediaRecorder.onstop = async () => {
            if (!isUploadingRef.current) return;

            const blob = new Blob(chunks, { type: "video/webm" });
            const cloudName =
              process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
              "your_cloud_name";
            const uploadPreset =
              process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "your_preset";

            try {
              const formData = new FormData();
              formData.append("file", blob);
              formData.append("upload_preset", uploadPreset);

              const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
                {
                  method: "POST",
                  body: formData,
                }
              );

              if (response.ok) {
                const data = await response.json();
                onRecordingComplete(data.secure_url);
              }
            } catch (error) {
              console.error("Upload error:", error);
            }
          };

          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.start();
        }
      } catch (err) {
        console.error("웹캠 접근 에러:", err);
      }
    };

    setupWebcam();

    // cleanup
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (countIntervalRef.current) {
        clearInterval(countIntervalRef.current);
      }
    };
  }, []);

  // 마우스 이벤트 핸들러
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 10 && !showOverlay) {
        // 화면 왼쪽 가장자리에서 마우스를 움직이면 카운트다운 시작
        setShowOverlay(true);
        startCountdownAndRecording();
      } else if (showOverlay) {
        // 카운트다운 중 마우스 움직임이 있으면 카운트다운 취소하고 녹화 계속
        cancelCountdown();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [showOverlay]);

  const cancelCountdown = () => {
    // 카운트다운 취소
    if (countIntervalRef.current) {
      clearInterval(countIntervalRef.current);
      countIntervalRef.current = null;
    }

    // 오버레이 숨기기
    setShowOverlay(false);
  };

  const startCountdownAndRecording = () => {
    // 이전 카운트다운이 있으면 정리
    if (countIntervalRef.current) {
      clearInterval(countIntervalRef.current);
    }

    let count = 5;
    setCountdown(count);

    countIntervalRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);

      if (count === 0) {
        if (countIntervalRef.current) {
          clearInterval(countIntervalRef.current);
          countIntervalRef.current = null;
        }
        stopRecordingAndUpload();
      }
    }, 1000);
  };

  const stopRecordingAndUpload = async () => {
    console.log("stopRecordingAndUpload");
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      isUploadingRef.current = true;
      mediaRecorderRef.current.stop();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress =
        (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* 프로그레스 바 */}
      <div className="fixed top-0 left-0 w-full h-2">
        <div
          className="h-full bg-white transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 샘플 비디오와 웹캠 컨테이너 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
        {/* 상단 샘플 비디오 */}
        <div className="w-1/3">
          <video
            ref={videoRef}
            className="w-full h-full object-cover rounded-lg"
            autoPlay
            loop
            muted
            playsInline
            src="/sample/dolly zoom - jaws.mov"
            onTimeUpdate={handleTimeUpdate}
          />
        </div>

        {/* 하단 웹캠 영상 */}
        <div className="w-3/5 flex-1">
          <video
            ref={webcamRef}
            className="w-full h-full object-cover rounded-lg"
            autoPlay
            playsInline
            muted
          />
        </div>
      </div>

      {/* 오버레이 */}
      {showOverlay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-center text-white">
            <p className="text-4xl mb-4">
              Your dolly zoom will be completed in {countdown}.
            </p>
            <p className="text-2xl">Don't move the camera to get your movie.</p>
          </div>
        </div>
      )}
    </div>
  );
};
