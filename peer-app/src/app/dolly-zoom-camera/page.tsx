"use client";

import { useEffect, useRef, useState } from "react";

import Image from "next/image";
import Peer from "peerjs";
import { generateUniqueId } from "@/utils/generateUniqueId";

const DollyZoomCamera = () => {
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  const [myUniqueId, setMyUniqueId] = useState<string>("");
  const [viewerId, setViewerId] = useState<string>("");
  const [callStatus, setCallStatus] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<string>("연결 중...");
  const [isStreaming, setIsStreaming] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const MAX_RECORDING_DURATION = 60; // 최대 녹화 시간 (초)
  const [zoomLevel, setZoomLevel] = useState<number>(2);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // 필요한 추가 ref 선언
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 로그를 화면에 표시하기 위한 함수
  const addDebugLog = (message: string) => {
    setDebugLogs((prev) => [
      ...prev.slice(-9),
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  // 안전하게 getUserMedia를 호출하는 함수
  const safeGetUserMedia = async () => {
    try {
      // 먼저 권한 상태 확인
      const permissions = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });

      if (permissions.state === "denied") {
        return Promise.reject(new Error("Camera permission denied"));
      }

      // 모바일 브라우저 호환성 처리
      if (!navigator.mediaDevices) {
        // 일부 오래된 브라우저에서는 mediaDevices가 없을 수 있음
        return Promise.reject(new Error("mediaDevices not supported"));
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
          zoom: 2, // 초기 줌 레벨을 2로 설정
        } as MediaTrackConstraints,
        audio: true,
      });

      // 줌 기능 지원 확인 및 초기 설정
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && "getCapabilities" in videoTrack) {
        const capabilities =
          videoTrack.getCapabilities() as MediaTrackCapabilities;
        if (capabilities.zoom) {
          addDebugLog(
            `Zoom supported: ${capabilities.zoom.min} - ${capabilities.zoom.max}`
          );
          // 초기 줌 레벨 설정
          await videoTrack.applyConstraints({
            advanced: [{ zoom: zoomLevel } as MediaTrackConstraintSet],
          });
        }
      }

      return stream;
    } catch (err) {
      console.error("Media access error:", err);

      if (err instanceof Error) {
        switch (err.name) {
          case "NotAllowedError":
            break;
          case "NotFoundError":
            // 오디오만 시도
            try {
              const audioOnlyStream = await navigator.mediaDevices.getUserMedia(
                {
                  video: false,
                  audio: true,
                }
              );
              return audioOnlyStream;
            } catch (audioErr) {}
            break;
          case "NotReadableError":
            break;
          case "OverconstrainedError":
            // 더 낮은 해상도로 재시도
            try {
              const lowResStream = await navigator.mediaDevices.getUserMedia({
                video: true, // 제약 조건 없이 시도
                audio: true,
              });
              return lowResStream;
            } catch (lowResErr) {}
            break;
          default:
            break;
        }
      } else {
      }
      throw err;
    }
  };

  // 환경에 따라 다른 PeerJS 서버 설정 사용
  const getPeerConfig = () => {
    // 개발 환경
    if (process.env.NODE_ENV === "development") {
      return {
        host: "localhost",
        port: 9000,
        path: "/myapp",
        secure: false,
      };
    }

    // 프로덕션 환경 - 버셀 배포용 설정
    const isSecure =
      typeof window !== "undefined" && window.location.protocol === "https:";

    // Railway는 일반적으로 포트를 명시적으로 지정하지 않음
    return {
      host: process.env.NEXT_PUBLIC_API_URL || window.location.hostname,
      // Railway에서는 포트를 생략하고 기본 HTTPS 포트(443) 사용
      // port: 8080,
      path: "/myapp",
      secure: isSecure,
      debug: 3,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" },
          // TURN 서버 추가 (WebRTC 연결이 NAT/방화벽 뒤에서 실패할 경우 필요)
          {
            urls: "turn:numb.viagenie.ca",
            username: "webrtc@live.com",
            credential: "muazkh",
          },
        ],
      },
    };
  };

  // 새로운 함수: URL에서 viewerId 파라미터 가져오기
  const getViewerIdFromUrl = () => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get("id");
      return id || "dolly-zoom-viewer"; // 기본값 제공
    }
    return "dolly-zoom-viewer"; // 서버 사이드에서는 기본값 반환
  };

  const startRecording = async (stream: MediaStream) => {
    recordedChunksRef.current = [];
    setRecordingDuration(0); // 녹화 시간 초기화

    try {
      // 녹화 전 현재 줌 레벨 적용
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && "getCapabilities" in videoTrack) {
        const capabilities =
          videoTrack.getCapabilities() as MediaTrackCapabilities;
        if (capabilities.zoom) {
          await videoTrack.applyConstraints({
            advanced: [{ zoom: zoomLevel } as MediaTrackConstraintSet],
          });
          addDebugLog(`녹화 시작 전 줌 레벨 설정: ${zoomLevel}`);
        }
      }

      // 지원하는 MIME 타입 확인
      const mimeTypes = [
        "video/webm;codecs=vp8", // vp8이 일반적으로 더 작은 파일 크기
        "video/webm",
        "video/mp4",
        "video/webm;codecs=vp9",
      ];

      let mimeType = "";
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          addDebugLog(`지원하는 MIME 타입: ${type}`);
          break;
        }
      }

      if (!mimeType) {
        addDebugLog("지원하는 비디오 MIME 타입을 찾을 수 없습니다.");
        return;
      }

      try {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: 800000, // 800 Kbps로 더 낮게 제한 (파일 크기 감소)
        });

        // 5초마다 데이터 청크 생성
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
            addDebugLog(
              `녹화 청크 크기: ${(event.data.size / 1024 / 1024).toFixed(2)}MB`
            );
          }
        };

        mediaRecorder.start(5000); // 5초마다 청크 생성
        mediaRecorderRef.current = mediaRecorder;
        addDebugLog("녹화가 시작되었습니다. (비트레이트: 800Kbps)");

        // 1분 타이머 설정
        const timer = window.setInterval(() => {
          setRecordingDuration((prev) => {
            const newDuration = prev + 1;

            // 최대 녹화 시간 도달 시 자동 종료
            if (newDuration >= MAX_RECORDING_DURATION) {
              addDebugLog("최대 녹화 시간(1분) 도달, 자동 종료");
              clearInterval(timer);
              handleCut(); // 녹화 종료 함수 호출
            }

            return newDuration;
          });
        }, 1000);

        setRecordingTimer(timer);
      } catch (err) {
        addDebugLog(`MediaRecorder 생성 실패: ${err}`);
      }
    } catch (err) {
      addDebugLog(`녹화 시작 전 줌 설정 실패: ${err}`);
    }
  };

  const stopRecordingAndSave = async () => {
    return new Promise<string>((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error("MediaRecorder를 찾을 수 없습니다."));
        return;
      }

      // 타이머 정리
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }

      addDebugLog("녹화 중지 중...");
      mediaRecorderRef.current.onstop = async () => {
        try {
          addDebugLog("녹화 중지됨, Blob 생성 중...");
          const blob = new Blob(recordedChunksRef.current, {
            type: mediaRecorderRef.current?.mimeType || "video/webm",
          });
          const sizeMB = blob.size / 1024 / 1024;
          addDebugLog(`Blob 생성됨 (크기: ${sizeMB.toFixed(2)}MB)`);

          // 파일 크기가 너무 크면 압축 시도
          let uploadBlob = blob;
          if (sizeMB > 10) {
            // Cloudinary 무료 계정 제한
            addDebugLog(`파일 크기가 큽니다. 압축 시도 중...`);
            try {
              // 비디오 압축 로직 (간단한 해상도 축소)
              const compressedBlob = await compressVideo(blob);
              const compressedSizeMB = compressedBlob.size / 1024 / 1024;
              addDebugLog(`압축 후 크기: ${compressedSizeMB.toFixed(2)}MB`);
              uploadBlob = compressedBlob;
            } catch (compressErr) {
              addDebugLog(`압축 실패: ${compressErr}. 원본 사용`);
            }
          }

          // Cloudinary 직접 업로드 (서버 우회)
          addDebugLog("Cloudinary에 직접 업로드 시도...");
          const videoUrl = await uploadToCloudinary(uploadBlob);
          addDebugLog("Cloudinary 업로드 완료, URL 수신됨");
          resolve(videoUrl);
        } catch (error) {
          addDebugLog(`저장 중 오류 발생: ${error}`);
          reject(error);
        }
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        addDebugLog(`MediaRecorder.stop() 호출 중 오류: ${error}`);
        reject(error);
      }
    });
  };

  // 캔버스 초기화 및 비디오 스트림 처리 함수
  const setupCanvas = async (videoStream: MediaStream) => {
    if (!canvasRef.current || !myVideoRef.current) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 캔버스 크기 설정 (비디오와 동일하게)
    const videoTrack = videoStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();

    // 비디오 트랙의 실제 해상도 사용
    const width = settings.width || 1280;
    const height = settings.height || 720;

    canvas.width = width;
    canvas.height = height;

    // 비디오 요소에 원본 스트림 연결
    myVideoRef.current.srcObject = videoStream;

    // 캔버스에 비디오 그리기 함수
    const drawVideoWithZoom = () => {
      if (!ctx || !myVideoRef.current) return;

      // 캔버스 지우기
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 줌 계산 (중앙에서 확대)
      const scaleFactor = zoomLevel;
      const scaledWidth = canvas.width / scaleFactor;
      const scaledHeight = canvas.height / scaleFactor;
      const centerX = (canvas.width - scaledWidth) / 2;
      const centerY = (canvas.height - scaledHeight) / 2;

      // 비디오를 캔버스에 그리기 (줌 적용)
      ctx.drawImage(
        myVideoRef.current,
        centerX,
        centerY,
        scaledWidth,
        scaledHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // 다음 프레임 요청
      animationFrameRef.current = requestAnimationFrame(drawVideoWithZoom);
    };

    // 애니메이션 시작
    drawVideoWithZoom();

    // 캔버스에서 스트림 생성
    try {
      const canvasStream = canvas.captureStream(30); // 30fps

      // 오디오 트랙 추가 (원본 스트림에서)
      const audioTracks = videoStream.getAudioTracks();
      audioTracks.forEach((track) => {
        canvasStream.addTrack(track);
      });

      canvasStreamRef.current = canvasStream;
      addDebugLog("캔버스 스트림 생성 성공");

      return canvasStream;
    } catch (err) {
      addDebugLog(`캔버스 스트림 생성 실패: ${err}`);
      return null;
    }
  };

  // 기존 handleCall 함수 수정
  const handleCall = () => {
    addDebugLog("handleCall 시작");

    if (!peerInstance) {
      addDebugLog("peerInstance가 없음");
      setCallStatus(
        "PeerJS 인스턴스가 준비되지 않았습니다. 잠시 후 다시 시도해주세요."
      );
      return;
    }

    setCallStatus("미디어 스트림 요청 중...");

    safeGetUserMedia()
      .then(async (stream) => {
        addDebugLog("미디어 스트림 획득 성공");

        // 캔버스 설정 및 줌 효과가 적용된 스트림 생성
        const canvasStream = await setupCanvas(stream);

        if (!canvasStream) {
          addDebugLog("캔버스 스트림 생성 실패, 원본 스트림 사용");

          if (myVideoRef.current) {
            myVideoRef.current.srcObject = stream;
          }

          // 원본 스트림으로 진행
          proceedWithCall(stream);
        } else {
          addDebugLog("캔버스 스트림 생성 성공, 줌 효과 적용됨");
          proceedWithCall(canvasStream);
        }
      })
      .catch((err) => {
        addDebugLog(`통화 실패: ${err.toString()}`);
        setCallStatus(`통화 실패: ${err.toString()}`);
        setIsStreaming(false);
      });
  };

  // 통화 진행 함수 (스트림 분리)
  const proceedWithCall = (stream: MediaStream) => {
    if (!peerInstance) return;

    const call = peerInstance.call(viewerId, stream);
    addDebugLog("피어 호출 시도: " + viewerId);

    if (!call) {
      addDebugLog("통화 연결 실패");
      setCallStatus("통화 연결에 실패했습니다. 상대방 ID를 확인해주세요.");
      return;
    }

    setIsStreaming(true);
    setCallStatus("스트리밍 시작됨");
    addDebugLog("스트리밍 상태 true로 설정");

    startRecording(stream);
    addDebugLog("녹화 시작됨");

    call.on("stream", (userVideoStream) => {
      addDebugLog("상대방 스트림 수신 성공");
      setCallStatus("상대방 스트림 연결됨");
    });

    call.on("error", (err) => {
      addDebugLog(`통화 오류: ${err.toString()}`);
      setCallStatus(`통화 오류: ${err.toString()}`);
      setIsStreaming(false);
    });

    call.on("close", () => {
      addDebugLog("통화 종료됨");
      setCallStatus("통화가 종료되었습니다.");
      setIsStreaming(false);
    });
  };

  const handleCut = async () => {
    try {
      addDebugLog("녹화 종료 시도 중...");
      setIsProcessing(true); // 처리 시작

      if (!mediaRecorderRef.current) {
        addDebugLog("MediaRecorder가 없습니다.");
        setCallStatus("MediaRecorder가 초기화되지 않았습니다.");
        return;
      }

      const videoUrl = await stopRecordingAndSave();
      addDebugLog("녹화 파일 저장 완료: " + videoUrl);

      if (peerInstance) {
        addDebugLog("녹화 영상 URL 전송 시도");
        const conn = peerInstance.connect(viewerId);
        conn.on("open", () => {
          conn.send({
            type: "recorded-video",
            url: videoUrl,
          });
          addDebugLog("녹화 영상 URL 전송 완료");
        });
      }

      setIsStreaming(false);
      addDebugLog("스트리밍 종료");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addDebugLog(`녹화 종료 오류: ${errorMessage}`);
      setCallStatus(`녹화 종료 중 오류: ${errorMessage}`);
    } finally {
      setIsProcessing(false); // 처리 완료
    }
  };

  // 더 간단한 비디오 압축 함수 (오디오 없음)
  const compressVideo = async (videoBlob: Blob): Promise<Blob> => {
    // 이미 크기가 작으면 그대로 반환
    if (videoBlob.size < 10 * 1024 * 1024) {
      return videoBlob;
    }

    addDebugLog("간단한 압축 방식 사용 중...");

    // 더 낮은 비트레이트로 MediaRecorder 설정
    try {
      // 비디오를 다시 녹화하는 대신 Cloudinary 변환 파라미터 사용
      return videoBlob;
    } catch (err) {
      addDebugLog(`압축 실패: ${err}`);
      return videoBlob;
    }
  };

  // Cloudinary 업로드 함수 수정
  const uploadToCloudinary = async (videoBlob: Blob) => {
    try {
      addDebugLog("Cloudinary에 직접 업로드 시도...");
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

      // eager 및 angle 파라미터 제거 (unsigned 업로드에서는 사용 불가)

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

      // 원본 URL에 회전 변환 파라미터 추가
      // 형식: https://res.cloudinary.com/cloud_name/video/upload/a_-90/video_id
      const originalUrl = data.secure_url;
      const transformedUrl = originalUrl.replace(
        "/upload/",
        "/upload/a_-90,q_auto:low/"
      );

      addDebugLog(`변환된 URL: ${transformedUrl}`);

      return transformedUrl;
    } catch (error) {
      addDebugLog(`Cloudinary 업로드 오류: ${error}`);
      throw error;
    }
  };

  // PeerJS 인스턴스 생성 시 설정 사용
  useEffect(() => {
    if (myUniqueId) {
      let peer: Peer;
      if (typeof window !== "undefined") {
        const peerConfig = getPeerConfig();

        // 더 자세한 디버깅 정보
        const wsUrl = `${peerConfig.secure ? "wss" : "ws"}://${
          peerConfig.host
        }${peerConfig.port ? `:${peerConfig.port}` : ""}${peerConfig.path}`;

        setConnectionStatus("PeerJS 서버에 연결 중...");

        // 디버깅을 위한 추가 정보
        console.log("PeerJS 설정:", peerConfig);
        console.log("현재 URL:", window.location.href);
        console.log(
          "WebSocket URL:",
          `${peerConfig.secure ? "wss" : "ws"}://${peerConfig.host}:${
            peerConfig.port
          }${peerConfig.path}`
        );

        peer = new Peer(myUniqueId, peerConfig);

        // 연결 이벤트 리스너 추가
        peer.on("open", (id) => {
          setConnectionStatus("PeerJS 서버에 연결됨");
        });

        peer.on("error", (err) => {
          console.error("PeerJS 오류:", err);
          setConnectionStatus(`연결 오류: ${err.type}`);

          // 연결 재시도 로직
          if (
            err.type === "network" ||
            err.type === "server-error" ||
            err.type === "socket-error"
          ) {
            setConnectionStatus("5초 후 재연결 시도...");
            setTimeout(() => {
              setConnectionStatus("재연결 시도 중...");
              peer.reconnect();
            }, 5000);
          }
        });

        setPeerInstance(peer);

        safeGetUserMedia()
          .then((stream) => {
            if (myVideoRef.current) {
              myVideoRef.current.srcObject = stream;
            }
          })
          .catch((err) => {
            console.error("Initial media setup failed:", err);
            setConnectionStatus("미디어 설정 실패");
          });
      }
      return () => {
        if (peer) {
          peer.destroy();
        }
      };
    }
  }, [myUniqueId]);

  useEffect(() => {
    const newId = generateUniqueId();
    setMyUniqueId(newId);
    // URL에서 viewerId 가져오기
    const urlViewerId = getViewerIdFromUrl();
    setViewerId(urlViewerId);
    addDebugLog(`Viewer ID from URL: ${urlViewerId}`);
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [recordingTimer]);

  // 터치 시작 처리
  const handleTouchStart = (e: React.TouchEvent | TouchEvent) => {
    if ("touches" in e && e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  };

  // 터치 이동 처리
  const handleTouchMove = (e: React.TouchEvent | TouchEvent) => {
    if (!isDraggingRef.current || touchStartYRef.current === null) return;

    if ("touches" in e) {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartYRef.current;

      // 드래그 방향: 아래로 드래그하면 줌인(확대), 위로 드래그하면 줌아웃(축소)
      setZoomLevel((prev) => {
        // 최소값을 0.5로 설정하여 더 축소 가능하도록 함
        const newZoom = Math.max(0.5, Math.min(10, prev + deltaY * 0.1));
        updateZoom(newZoom);
        return newZoom;
      });

      touchStartYRef.current = currentY;
    }
  };

  // 터치 종료 처리
  const handleTouchEnd = () => {
    touchStartYRef.current = null;
    isDraggingRef.current = false;
  };

  // 줌 레벨 변경 시 캔버스 업데이트만 필요 (자동으로 적용됨)
  // 기존 updateZoom 함수는 더 이상 필요 없음
  const updateZoom = (newZoomLevel: number) => {
    setZoomLevel(newZoomLevel);
    addDebugLog(`Zoom level set to: ${newZoomLevel}`);
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 터치 이벤트 리스너 설정
  useEffect(() => {
    const videoElement = myVideoRef.current;
    if (videoElement) {
      videoElement.addEventListener("touchstart", handleTouchStart);
      videoElement.addEventListener("touchmove", handleTouchMove);
      videoElement.addEventListener("touchend", handleTouchEnd);
      videoElement.addEventListener("touchcancel", handleTouchEnd);

      return () => {
        videoElement.removeEventListener("touchstart", handleTouchStart);
        videoElement.removeEventListener("touchmove", handleTouchMove);
        videoElement.removeEventListener("touchend", handleTouchEnd);
        videoElement.removeEventListener("touchcancel", handleTouchEnd);
      };
    }
  }, []);

  return (
    <div className="relative h-[100dvh] w-[100dvw] overflow-hidden">
      {/* 숨겨진 캔버스 */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* 비디오 요소 (미리보기용) */}
      <video
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          touchAction: "none",
          transformOrigin: "center",
        }}
        playsInline
        ref={myVideoRef}
        autoPlay
        muted
        onTouchStart={handleTouchStart as any}
        onTouchMove={handleTouchMove as any}
        onTouchEnd={handleTouchEnd as any}
        onTouchCancel={handleTouchEnd as any}
      />

      {/* 현재 줌 레벨 표시 (선택사항) */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded">
        {Math.round(zoomLevel * 100) / 100}x
      </div>
      <button
        onClick={isStreaming ? handleCut : handleCall}
        disabled={isProcessing}
        className="absolute top-1/2 transform -translate-y-1/2 rotate-90 bg-black text-white px-6 py-4 rounded-xl font-bold text-xl"
      >
        {isStreaming ? "Cut! 🎬" : "Action! 🎬"}
      </button>

      {/* 중앙 로딩 인디케이터 */}
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="flex flex-col items-center gap-4">
            <Image
              src="/loading.svg"
              alt="uploading..."
              width={100}
              height={24}
              priority
              className="rotate-90"
            />
          </div>
        </div>
      )}

      {/* 디버깅 정보와 로그를 함께 표시 */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded text-sm max-w-[80%] overflow-hidden">
        <div>연결 상태: {connectionStatus}</div>
        <div>통화 상태: {callStatus}</div>
        <div>스트리밍: {isStreaming ? "켜짐" : "꺼짐"}</div>
        <div>뷰어 ID: {viewerId}</div>
        <div className="h-px bg-white my-2" />
        <div className="text-xs">
          {debugLogs.map((log, index) => (
            <div
              key={index}
              className="whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DollyZoomCamera;
