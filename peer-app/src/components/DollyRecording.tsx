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
  const previousMouseXRef = useRef<number | null>(null);
  const TRIGGER_ZONE = 20; // 카운트다운 트리거 영역 설정
  const [zoomScale, setZoomScale] = useState(1.5);
  const MAX_ZOOM = 3.5; // 최대 줌 스케일 (왼쪽)
  const MIN_ZOOM = 1.5; // 최소 줌 스케일 (오른쪽)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize] = useState({ width: 3840, height: 2160 }); // 16:9 4K resolution

  // 웹캠 설정을 처음 한 번만 실행
  useEffect(() => {
    let stream: MediaStream;
    let canvasStream: MediaStream;

    const setupWebcam = async () => {
      try {
        // 웹캠 해상도를 최대한 높게 설정
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            frameRate: { ideal: 60 },
          },
        });

        if (webcamRef.current && canvasRef.current) {
          webcamRef.current.srcObject = stream;

          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d", {
            alpha: false, // 알파 채널 비활성화로 성능 향상
            willReadFrequently: false, // 픽셀 읽기 최적화
          });

          if (ctx) {
            // 이미지 렌더링 품질 설정
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // Canvas 크기 설정
            canvas.width = canvasSize.width;
            canvas.height = canvasSize.height;

            // Canvas에 줌 효과를 적용하여 그리기
            const drawFrame = () => {
              if (webcamRef.current && ctx) {
                ctx.save();

                // Canvas 초기화
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // 중앙 기준 줌 효과 적용
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.scale(zoomScale, zoomScale);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);

                // 비디오 프레임 그리기
                ctx.drawImage(
                  webcamRef.current,
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );

                ctx.restore();
              }
              requestAnimationFrame(drawFrame);
            };
            drawFrame();

            // Canvas 스트림 생성
            canvasStream = canvas.captureStream(60); // 60fps로 증가

            // 녹화 설정
            const mediaRecorder = new MediaRecorder(canvasStream);
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
                process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
                "your_preset";

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
      if (canvasStream) {
        canvasStream.getTracks().forEach((track) => track.stop());
      }
      if (countIntervalRef.current) {
        clearInterval(countIntervalRef.current);
      }
    };
  }, []);

  // 마우스 이벤트 핸들러
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX;
      const windowWidth = window.innerWidth;

      // X 위치를 0-1 사이의 값으로 정규화 (오른쪽이 최대값)
      const normalizedX = currentX / windowWidth;

      // 정규화된 값을 MIN_ZOOM에서 MAX_ZOOM 사이로 매핑
      const newScale = MIN_ZOOM + normalizedX * (MAX_ZOOM - MIN_ZOOM);
      setZoomScale(newScale);

      // 트리거 영역에서 카운트다운 시작
      if (currentX <= TRIGGER_ZONE && !showOverlay) {
        setShowOverlay(true);
        startCountdownAndRecording();
      } else if (currentX > TRIGGER_ZONE && showOverlay) {
        cancelCountdown();
      }

      previousMouseXRef.current = currentX;
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

  // zoomScale이 변경될 때마다 캔버스를 다시 그리도록 수정
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = webcamRef.current;
    const ctx = canvas?.getContext("2d", {
      alpha: false,
      willReadFrequently: false,
    });

    if (!canvas || !video || !ctx) return;

    const drawFrame = () => {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 중앙 기준 줌 효과 적용
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // 이미지 렌더링 품질 설정
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      // cleanup
    };
  }, [zoomScale]); // zoomScale을 의존성 배열에 추가

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
      <div className="flex flex-col items-center justify-center gap-4 p-4 overflow-hidden">
        {/* 상단 샘플 비디오 */}
        <div className="w-1/4">
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

        {/* 하단 웹캠 영상 (캔버스로 대체) */}
        <div className="overflow-hidden flex justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-lg max-w-full h-auto"
            style={{
              width: "100%",
              maxWidth: "1920px", // 디스플레이 크기는 FHD로 제한
            }}
            width={canvasSize.width}
            height={canvasSize.height}
          />
          <video
            ref={webcamRef}
            className="w-0 h-0 opacity-0"
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
