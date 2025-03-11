"use client";

import { useEffect, useRef, useState } from "react";

import Image from "next/image";
import Peer from "peerjs";

const PEER_ID = "arc-shot-camera";
const PEER_VIEWER_ID = "arc-shot-viewer";

const PeerPage = () => {
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  const [myUniqueId, setMyUniqueId] = useState<string>("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [callStatus, setCallStatus] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<string>("연결 중...");
  const [isStreaming, setIsStreaming] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const MAX_RECORDING_DURATION = 60; // 최대 녹화 시간 (초)

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
      setDebugInfo("미디어 장치 접근 시도 중...");
      // 먼저 권한 상태 확인
      const permissions = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });

      if (permissions.state === "denied") {
        setMediaError(
          "카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요."
        );
        return Promise.reject(new Error("Camera permission denied"));
      }

      // 모바일 브라우저 호환성 처리
      if (!navigator.mediaDevices) {
        // 일부 오래된 브라우저에서는 mediaDevices가 없을 수 있음
        setMediaError("이 브라우저는 미디어 장치 접근을 지원하지 않습니다.");
        return Promise.reject(new Error("mediaDevices not supported"));
      }

      // 모바일에서는 더 낮은 해상도로 시작하는 것이 좋음
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "environment",
        },
        audio: true,
      });

      return stream;
    } catch (err) {
      setDebugInfo(
        `오류 발생: ${err instanceof Error ? err.name : "알 수 없는 오류"}`
      );
      console.error("Media access error:", err);

      if (err instanceof Error) {
        switch (err.name) {
          case "NotAllowedError":
            setMediaError(
              "카메라/마이크 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요."
            );
            break;
          case "NotFoundError":
            setMediaError(
              "카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요."
            );
            // 오디오만 시도
            try {
              const audioOnlyStream = await navigator.mediaDevices.getUserMedia(
                {
                  video: false,
                  audio: true,
                }
              );
              return audioOnlyStream;
            } catch (audioErr) {
              setMediaError("오디오 접근에도 실패했습니다.");
            }
            break;
          case "NotReadableError":
            setMediaError(
              "카메라에 접근할 수 없습니다. 다른 앱이 카메라를 사용 중인지 확인해주세요."
            );
            break;
          case "OverconstrainedError":
            setMediaError(
              "요청한 미디어 형식이 지원되지 않습니다. 더 낮은 해상도로 시도합니다."
            );
            // 더 낮은 해상도로 재시도
            try {
              const lowResStream = await navigator.mediaDevices.getUserMedia({
                video: true, // 제약 조건 없이 시도
                audio: true,
              });
              return lowResStream;
            } catch (lowResErr) {
              setMediaError("낮은 해상도에서도 카메라 접근에 실패했습니다.");
            }
            break;
          default:
            setMediaError(`카메라/마이크 접근에 실패했습니다: ${err.message}`);
        }
      } else {
        setMediaError("알 수 없는 오류로 카메라/마이크 접근에 실패했습니다.");
      }
      throw err;
    }
  };

  // 디버깅 정보 표시 함수
  const showConnectionInfo = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const expectedWsProtocol = protocol === "https:" ? "wss:" : "ws:";
    const port = process.env.NODE_ENV === "development" ? "9000" : "";
    const portStr = port ? `:${port}` : "";

    setDebugInfo(`
      페이지 프로토콜: ${protocol}
      호스트: ${hostname}
      예상 WebSocket 프로토콜: ${expectedWsProtocol}
      PeerJS 연결 URL: ${expectedWsProtocol}//${hostname}${portStr}/myapp
    `);
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

  const startRecording = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    setRecordingDuration(0); // 녹화 시간 초기화

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
          const cloudName =
            process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "your_cloud_name";
          const uploadPreset =
            process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "your_preset";

          const formData = new FormData();
          formData.append("file", uploadBlob);
          formData.append("upload_preset", uploadPreset);
          formData.append("resource_type", "video");
          // 비디오 최적화 옵션
          formData.append("quality", "auto:low"); // 낮은 품질로 설정

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
          const videoUrl = data.secure_url;
          setRecordedVideoUrl(videoUrl);
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
      .then((stream) => {
        addDebugLog("미디어 스트림 획득 성공");

        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
          addDebugLog("비디오 요소에 스트림 연결됨");
        }

        const call = peerInstance.call(PEER_VIEWER_ID, stream);
        addDebugLog("피어 호출 시도: " + PEER_VIEWER_ID);

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
      })
      .catch((err) => {
        addDebugLog(`통화 실패: ${err.toString()}`);
        setCallStatus(`통화 실패: ${err.toString()}`);
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
        const conn = peerInstance.connect(PEER_VIEWER_ID);
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

  // 비디오 압축 함수 추가
  const compressVideo = async (videoBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        // 임시 비디오 및 캔버스 요소 생성
        const video = document.createElement("video");
        video.src = URL.createObjectURL(videoBlob);

        video.onloadedmetadata = () => {
          // 비디오 크기의 50%로 축소
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // 더 작은 해상도로 설정 (360p)
          canvas.width = 640;
          canvas.height = 360;

          video.currentTime = 0;

          video.onseeked = () => {
            // 비디오 스트림 생성
            const stream = canvas.captureStream(30); // 30fps

            // 오디오 트랙 추가 (원본에서)
            if (video.captureStream) {
              const audioTracks = video.captureStream().getAudioTracks();
              if (audioTracks.length > 0) {
                stream.addTrack(audioTracks[0]);
              }
            }

            // 낮은 비트레이트로 MediaRecorder 설정
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: "video/webm;codecs=vp8",
              videoBitsPerSecond: 500000, // 500 Kbps
            });

            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                chunks.push(e.data);
              }
            };

            mediaRecorder.onstop = () => {
              const compressedBlob = new Blob(chunks, { type: "video/webm" });
              resolve(compressedBlob);

              // 메모리 정리
              URL.revokeObjectURL(video.src);
            };

            // 프레임 그리기 함수
            const drawFrame = () => {
              if (ctx && !video.paused && !video.ended) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                requestAnimationFrame(drawFrame);
              }
            };

            // 녹화 시작
            mediaRecorder.start(1000);
            video.play();
            drawFrame();

            // 비디오 길이만큼 녹화
            setTimeout(() => {
              mediaRecorder.stop();
              video.pause();
            }, video.duration * 1000);
          };
        };

        video.onerror = () => {
          reject(new Error("비디오 로딩 중 오류 발생"));
        };
      } catch (err) {
        reject(err);
      }
    });
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

        setDebugInfo(
          `PeerJS 연결 시도 중...\n설정: ${JSON.stringify(
            peerConfig
          )}\nWebSocket URL: ${wsUrl}`
        );
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
          setDebugInfo(`PeerJS 연결 성공: ${id}`);
          setConnectionStatus("PeerJS 서버에 연결됨");
        });

        peer.on("error", (err) => {
          console.error("PeerJS 오류:", err);
          setDebugInfo(
            `PeerJS 오류: ${err.type} - ${
              err.message || "자세한 오류 정보 없음"
            }`
          );
          setMediaError(`PeerJS 연결 실패: ${err.type}`);
          setConnectionStatus(`연결 오류: ${err.type}`);

          // 연결 재시도 로직
          if (
            err.type === "network" ||
            err.type === "server-error" ||
            err.type === "socket-error"
          ) {
            setConnectionStatus("5초 후 재연결 시도...");
            setTimeout(() => {
              setDebugInfo("PeerJS 연결 재시도 중...");
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
    setMyUniqueId(PEER_ID);
  }, []);

  // 컴포넌트 마운트 시 정보 표시
  useEffect(() => {
    if (typeof window !== "undefined") {
      showConnectionInfo();
    }
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [recordingTimer]);

  return (
    <div className="relative h-screen w-screen">
      <video
        className="w-full h-full object-cover"
        playsInline
        ref={myVideoRef}
        autoPlay
        muted
      />
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

      {/* 녹화 시간 표시 추가 */}
      {isStreaming && (
        <div className="absolute top-20 left-4 bg-red-600 text-white px-4 py-2 rounded-lg z-10">
          녹화 중: {Math.floor(recordingDuration / 60)}:
          {(recordingDuration % 60).toString().padStart(2, "0")}
          {recordingDuration >= MAX_RECORDING_DURATION - 10 &&
            recordingDuration < MAX_RECORDING_DURATION && (
              <span className="ml-2 animate-pulse">곧 종료됩니다!</span>
            )}
        </div>
      )}
    </div>
  );
};

export default PeerPage;
