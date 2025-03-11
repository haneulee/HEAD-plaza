"use client";

import { useEffect, useRef, useState } from "react";

import Peer from "peerjs";

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
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
  };

  const stopRecordingAndSave = async () => {
    return new Promise<string>((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error("No media recorder found"));
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        try {
          const blob = new Blob(recordedChunksRef.current, {
            type: "video/webm",
          });

          // FormData 생성
          const formData = new FormData();
          formData.append("video", blob, "recorded-video.webm");

          // 서버에 영상 업로드
          const response = await fetch("/api/upload-video", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error("Failed to upload video");
          }

          const { videoUrl } = await response.json();
          setRecordedVideoUrl(videoUrl);
          resolve(videoUrl);
        } catch (error) {
          reject(error);
        }
      };

      mediaRecorderRef.current.stop();
    });
  };

  const handleCall = () => {
    if (!peerInstance) {
      setCallStatus(
        "PeerJS 인스턴스가 준비되지 않았습니다. 잠시 후 다시 시도해주세요."
      );
      return;
    }
    safeGetUserMedia()
      .then((stream) => {
        console.log("미디어 스트림 획득 성공, 통화 시도 중...", "dolly-zoom");
        const call = peerInstance.call("dolly-zoom", stream);

        if (!call) {
          setCallStatus("통화 연결에 실패했습니다. 상대방 ID를 확인해주세요.");
          return;
        }

        setIsStreaming(true);
        startRecording(stream); // 녹화 시작

        call.on("stream", (userVideoStream) => {
          console.log("상대방 스트림 수신 성공");
        });

        call.on("error", (err) => {
          console.error("통화 중 오류 발생:", err);
          setCallStatus(`통화 오류: ${err.toString()}`);
          setIsStreaming(false); // 에러 발생 시 스트리밍 상태 해제
        });

        call.on("close", () => {
          setCallStatus("통화가 종료되었습니다.");
          setIsStreaming(false); // 통화 종료 시 스트리밍 상태 해제
        });
      })
      .catch((err) => {
        console.error("Call failed:", err);
        setCallStatus(`통화 실패: ${err.toString()}`);
        setIsStreaming(false); // 실패 시 스트리밍 상태 해제
      });
  };

  const handleCut = async () => {
    try {
      const videoUrl = await stopRecordingAndSave();

      // dolly-zoom 피어에게 녹화된 영상 URL 전달
      if (peerInstance) {
        const conn = peerInstance.connect("dolly-zoom");
        conn.on("open", () => {
          conn.send({
            type: "recorded-video",
            url: videoUrl,
          });
        });
      }

      setIsStreaming(false);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setCallStatus("녹화 종료 중 오류가 발생했습니다.");
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
    setMyUniqueId("dolly-zoom-camera");
  }, []);

  // 컴포넌트 마운트 시 정보 표시
  useEffect(() => {
    if (typeof window !== "undefined") {
      showConnectionInfo();
    }
  }, []);

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
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 rotate-90 bg-black text-white px-8 py-3 rounded-lg font-bold mb-8"
      >
        {isStreaming ? "Cut!" : "Action!"}
      </button>
    </div>
  );
};

export default PeerPage;
