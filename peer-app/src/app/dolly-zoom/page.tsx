"use client";

import { useEffect, useRef, useState } from "react";

import { InfoPopup } from "@/components/InfoPopup";
import Peer from "peerjs";
import { QRCodeSVG } from "qrcode.react";
import { generateUniqueId } from "@/utils/generateUniqueId";

const DollyZoom = () => {
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const callingVideoRef = useRef<HTMLVideoElement>(null);

  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  const [myUniqueId, setMyUniqueId] = useState<string>("");
  const [receivedVideoUrl, setReceivedVideoUrl] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // URL에 ID 파라미터 추가하는 함수
  const updateUrlWithId = (id: string) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", id);
      window.history.replaceState({}, "", url.toString());
    }
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
          //
        });

        peer.on("error", (err) => {
          console.error("PeerJS 오류:", err);

          // 연결 재시도 로직
          if (
            err.type === "network" ||
            err.type === "server-error" ||
            err.type === "socket-error"
          ) {
            setTimeout(() => {
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

            peer.on("call", (call) => {
              console.log("Incoming call received.");
              setIsStreaming(true); // 스트리밍 시작

              call.answer(stream);
              call.on("stream", (userVideoStream) => {
                console.log("Remote stream received successfully");
                if (callingVideoRef.current) {
                  callingVideoRef.current.srcObject = userVideoStream;
                }
              });

              // call이 끊어질 때 처리
              call.on("close", () => {
                console.log("Call ended.");
                setIsStreaming(false);
                if (callingVideoRef.current) {
                  callingVideoRef.current.srcObject = null;
                }
              });
            });
          })
          .catch((err) => {
            console.error("Initial media setup failed:", err);
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
    // 고정 ID 대신 랜덤 ID 사용
    const newId = generateUniqueId();
    setMyUniqueId(newId);
    // URL에 ID 추가
    updateUrlWithId(newId);
  }, []);

  useEffect(() => {
    if (peerInstance) {
      // 데이터 연결 수신 대기
      peerInstance.on("connection", (conn) => {
        conn.on("data", (data: any) => {
          if (data.type === "recorded-video") {
            console.log("Received video URL:", data.url);
            setReceivedVideoUrl(data.url);
            setIsStreaming(false); // 스트리밍 종료
          }
        });
      });
    }
  }, [peerInstance]);

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Info 버튼 추가 */}
      <button
        onClick={() => setIsInfoOpen(true)}
        className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg hover:bg-opacity-70 z-10"
      >
        <span className="text-2xl">🍿</span>
      </button>
      {/* Info 팝업 */}
      <InfoPopup isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      {/* Top explanation section */}
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

      {/* Videos section */}
      <div className="flex flex-1 px-8 pb-8">
        {/* Left section */}
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
            />
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
            <h3 className="text-lg font-semibold mb-2">
              How to create your own:
            </h3>
            <ol className="text-gray-300 space-y-2 list-decimal list-inside">
              {/* <li>Position your subject in front of a deep background</li> */}
              <li>Start recording on the camera app</li>
              <li>
                Move the camera towards or away from the subject while
                simultaneously zooming in or out
              </li>
              <li>Keep your subject centered and the same size</li>
              <li>Stop recording when done</li>
            </ol>
          </div>
        </div>

        {/* Right video */}
        <div className="w-1/2 pl-4 flex flex-col">
          <>
            <h2 className="text-xl font-semibold mb-2">
              {isStreaming
                ? "Camera Preview"
                : receivedVideoUrl
                ? "Scan to view your Arc Shot"
                : " Scan to view your Arc Shot"}
            </h2>
            {isStreaming ? (
              <div className="aspect-video flex-shrink-0 relative flex items-center justify-center">
                <video
                  className="rounded-lg"
                  style={{
                    transform: "rotate(-90deg)",
                    width: "80%", // 16:9 비율의 높이를 너비로 사용 (9/16 = 0.5625)
                    objectFit: "cover",
                  }}
                  playsInline
                  ref={callingVideoRef}
                  autoPlay
                  muted
                />
              </div>
            ) : receivedVideoUrl ? (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg border border-gray-700">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG value={receivedVideoUrl} size={256} level="H" />
                </div>
                <p className="mt-4 text-gray-300">
                  Or click{" "}
                  <a
                    href={receivedVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    here
                  </a>{" "}
                  to view directly
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Ready to start!</h2>
                <p className="text-gray-300">
                  1. Follow the instructions on the left and start recording
                  from the camera app.
                  <br />
                  2. Your creation will appear here once complete.
                </p>
              </div>
            )}
          </>
        </div>
      </div>
    </div>
  );
};

export default DollyZoom;
