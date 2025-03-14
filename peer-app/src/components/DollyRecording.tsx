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
  const TRIGGER_ZONE = 20; // 카운트다운 트리거 영역 설정
  const MIN_ZOOM = 1.5; // x = 0일 때의 줌 값
  const MAX_ZOOM = 3.5; // x = window.innerWidth일 때의 줌 값
  const [zoomScale, setZoomScale] = useState(MAX_ZOOM);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize] = useState({ width: 3840, height: 2160 }); // 16:9 4K resolution
  const cropTop = 0.2; // 상단에서 20% 자르기 (고정값으로 변경)
  const [isLoading, setIsLoading] = useState(false);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null); // 녹화 시간 제한을 위한 타이머
  const MAX_RECORDING_TIME = 60000; // 최대 녹화 시간 (1분 = 60000ms)
  const [recordingTime, setRecordingTime] = useState(0); // 녹화 시간 상태
  const recordingStartTimeRef = useRef<number | null>(null); // 녹화 시작 시간 참조

  // Cloudinary 업로드 함수 수정
  const uploadToCloudinary = async (videoBlob: Blob) => {
    try {
      const cloudName =
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "your_cloud_name";
      const uploadPreset =
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "your_preset";

      const formData = new FormData();
      formData.append("file", videoBlob);
      formData.append("upload_preset", uploadPreset);
      formData.append("resource_type", "video");

      // 기본 최적화 옵션만 사용
      formData.append("quality", "auto:low");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudinary 업로드 실패 (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      setIsLoading(false); // 업로드 완료 시 로딩 숨김

      // 원본 URL에 회전 변환 파라미터 추가
      // 형식: https://res.cloudinary.com/cloud_name/video/upload/a_-90/video_id
      const originalUrl = data.secure_url;

      return originalUrl;
    } catch (error) {
      setIsLoading(false); // 에러 발생 시에도 로딩 숨김
      throw error;
    }
  };

  // 더 간단한 비디오 압축 함수 (오디오 없음)
  const compressVideo = async (videoBlob: Blob): Promise<Blob> => {
    // 이미 크기가 작으면 그대로 반환
    if (videoBlob.size < 10 * 1024 * 1024) {
      return videoBlob;
    }

    // 더 낮은 비트레이트로 MediaRecorder 설정
    try {
      // 비디오를 다시 녹화하는 대신 Cloudinary 변환 파라미터 사용
      return videoBlob;
    } catch (err) {
      return videoBlob;
    }
  };

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

                // 상단 부분을 자르고 나머지 부분을 확대하여 캔버스를 채우도록 수정
                const cropHeight = webcamRef.current.videoHeight * cropTop;
                ctx.drawImage(
                  webcamRef.current,
                  0,
                  cropHeight,
                  webcamRef.current.videoWidth,
                  webcamRef.current.videoHeight - cropHeight, // 소스 영역 (상단 부분 제외)
                  0,
                  0,
                  canvas.width,
                  canvas.height // 대상 영역 (전체 캔버스)
                );

                ctx.restore();
              }
              requestAnimationFrame(drawFrame);
            };
            drawFrame();

            // Canvas 스트림 생성
            canvasStream = canvas.captureStream(60);

            // MediaRecorder 옵션 설정
            const options = {
              mimeType: "video/mp4; codecs=h264",
              videoBitsPerSecond: 2500000, // 2.5Mbps
            };

            // 지원되는 MIME 타입 확인 및 설정
            if (MediaRecorder.isTypeSupported("video/mp4; codecs=h264")) {
              mediaRecorderRef.current = new MediaRecorder(
                canvasStream,
                options
              );
            } else if (MediaRecorder.isTypeSupported("video/mp4")) {
              mediaRecorderRef.current = new MediaRecorder(canvasStream, {
                mimeType: "video/mp4",
              });
            } else {
              // Fallback to default (probably webm)
              console.log("MP4 not supported, falling back to default format");
              mediaRecorderRef.current = new MediaRecorder(canvasStream);
            }

            const chunks: BlobPart[] = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
              if (e.data.size > 0) {
                chunks.push(e.data);
              }
            };

            mediaRecorderRef.current.onstop = async () => {
              if (!isUploadingRef.current) return;

              // Blob 생성 시 MP4 MIME 타입 지정
              const blob = new Blob(chunks, { type: "video/mp4" });
              const sizeMB = blob.size / 1024 / 1024;

              // 파일 크기가 너무 크면 압축 시도
              let uploadBlob = blob;
              if (sizeMB > 10) {
                // Cloudinary 무료 계정 제한

                try {
                  // 비디오 압축 로직 (간단한 해상도 축소)
                  const compressedBlob = await compressVideo(blob);
                  const compressedSizeMB = compressedBlob.size / 1024 / 1024;

                  uploadBlob = compressedBlob;
                } catch (compressErr) {}
              }

              // Cloudinary 직접 업로드 (서버 우회)

              const videoUrl = await uploadToCloudinary(uploadBlob);

              onRecordingComplete(videoUrl);
            };

            mediaRecorderRef.current.start();
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
      // 녹화 타이머 정리 추가
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
    };
  }, []);

  // 마우스 이벤트 핸들러
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const divWidth = rect.width;

    // 직접 줌 값 계산 (0부터 divWidth까지의 x값을 MIN_ZOOM부터 MAX_ZOOM까지 매핑)
    const newZoom = MIN_ZOOM + (currentX / divWidth) * (MAX_ZOOM - MIN_ZOOM);

    // 디버깅 로그
    console.log("Mouse move event:", {
      currentX,
      divWidth,
      newZoom,
      currentZoom: zoomScale,
      showOverlay,
      isInTriggerZone: currentX <= TRIGGER_ZONE,
    });

    setZoomScale(newZoom);

    // 왼쪽 트리거 영역 체크 (카운트다운 오버레이)
    if (currentX <= TRIGGER_ZONE && !showOverlay) {
      console.log("Starting countdown...");
      setShowOverlay(true);
      startCountdownAndRecording();
    } else if (currentX > TRIGGER_ZONE && showOverlay) {
      console.log("Canceling countdown...");
      cancelCountdown();
    }
  };

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

        // 녹화 시작 및 타이머 설정
        startRecording();
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
      setIsLoading(true); // 업로드 시작 시 로딩 표시
      isUploadingRef.current = true;

      // 녹화 타이머가 있으면 정리
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // 녹화 시간 초기화
      setRecordingTime(0);
      recordingStartTimeRef.current = null;

      mediaRecorderRef.current.stop();
    }
  };

  // 녹화 시작 함수 추가
  const startRecording = () => {
    // 녹화 시작 시간 기록
    recordingStartTimeRef.current = Date.now();

    // 녹화 시간 업데이트를 위한 인터벌 설정
    const updateRecordingTime = () => {
      if (recordingStartTimeRef.current) {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingTime(elapsed);

        // 1초마다 업데이트
        setTimeout(updateRecordingTime, 1000);
      }
    };

    // 첫 업데이트 시작
    updateRecordingTime();

    // 1분 후 자동 종료 타이머 설정
    recordingTimerRef.current = setTimeout(() => {
      console.log("Maximum recording time reached (1 minute)");
      stopRecordingAndUpload();
    }, MAX_RECORDING_TIME);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress =
        (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  // 캔버스 드로잉 최적화
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = webcamRef.current;
    const ctx = canvas?.getContext("2d", {
      alpha: false,
      willReadFrequently: false,
    });

    if (!canvas || !video || !ctx) return;

    let animationFrame: number;
    const drawFrame = () => {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // 상단 부분을 자르고 나머지 부분을 확대하여 캔버스를 채우도록 수정
      const cropHeight = video.videoHeight * cropTop;
      ctx.drawImage(
        video,
        0,
        cropHeight,
        video.videoWidth,
        video.videoHeight - cropHeight, // 소스 영역 (상단 부분 제외)
        0,
        0,
        canvas.width,
        canvas.height // 대상 영역 (전체 캔버스)
      );

      ctx.restore();

      animationFrame = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [zoomScale, cropTop]);

  return (
    <div
      className="flex flex-col h-screen relative"
      onMouseMove={handleMouseMove}
      style={{ cursor: "pointer" }}
    >
      {/* 프로그레스 바 */}
      <div className="fixed top-0 left-0 w-full h-2">
        <div
          className="h-full bg-white transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 녹화 시간 표시 */}
      {recordingTime > 0 && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center z-50">
          <div className="w-3 h-3 bg-red-400 rounded-full mr-2 animate-pulse"></div>
          <span>{Math.floor(recordingTime / 1000)}s / 60s</span>
        </div>
      )}

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
          <div className="relative" style={{ marginTop: "-10px" }}>
            {/* 하단 20px를 가리는 오버레이 */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-black z-10 rounded-b-lg"
              style={{ height: "20px" }}
            ></div>
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
      </div>

      {/* 로딩 오버레이 */}
      {isLoading ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <img
            src="/loading.svg"
            alt="Loading..."
            className="w-16 h-16" // 로딩 아이콘 크기 조정
          />
        </div>
      ) : showOverlay ? (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <p className="text-4xl mb-4">
              Your dolly zoom will be completed in {countdown}.
            </p>
            <p className="text-2xl">Don't move the camera to get your movie.</p>
          </div>
        </div>
      ) : (
        ""
      )}
    </div>
  );
};
