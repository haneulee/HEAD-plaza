"use client";

import { useEffect, useRef, useState } from "react";

import Peer from "peerjs";
import { QRCodeSVG } from "qrcode.react";

const PEER_VIEWER_ID = "dolly-zoom-viewer";

const PeerPage = () => {
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const callingVideoRef = useRef<HTMLVideoElement>(null);

  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  const [myUniqueId, setMyUniqueId] = useState<string>("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Connecting...");
  const [callStatus, setCallStatus] = useState<string>("");
  const [receivedVideoUrl, setReceivedVideoUrl] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // 안전하게 getUserMedia를 호출하는 함수
  const safeGetUserMedia = async () => {
    try {
      setDebugInfo("Attempting to access media devices...");
      // 먼저 권한 상태 확인
      const permissions = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });

      if (permissions.state === "denied") {
        setMediaError(
          "Camera access denied. Please enable camera permissions in your browser settings."
        );
        return Promise.reject(new Error("Camera permission denied"));
      }

      // 모바일 브라우저 호환성 처리
      if (!navigator.mediaDevices) {
        // 일부 오래된 브라우저에서는 mediaDevices가 없을 수 있음
        setMediaError("This browser does not support media device access.");
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
        `Error occurred: ${err instanceof Error ? err.name : "Unknown error"}`
      );
      console.error("Media access error:", err);

      if (err instanceof Error) {
        switch (err.name) {
          case "NotAllowedError":
            setMediaError(
              "Camera/microphone access denied. Please enable permissions in your browser settings."
            );
            break;
          case "NotFoundError":
            setMediaError(
              "Camera not found. Please check if a camera is connected."
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
              setMediaError("Audio access also failed.");
            }
            break;
          case "NotReadableError":
            setMediaError(
              "Cannot access camera. Please check if another app is using the camera."
            );
            break;
          case "OverconstrainedError":
            setMediaError(
              "Requested media format not supported. Trying with lower resolution."
            );
            // 더 낮은 해상도로 재시도
            try {
              const lowResStream = await navigator.mediaDevices.getUserMedia({
                video: true, // 제약 조건 없이 시도
                audio: true,
              });
              return lowResStream;
            } catch (lowResErr) {
              setMediaError("Camera access failed even with lower resolution.");
            }
            break;
          default:
            setMediaError(`Failed to access camera/microphone: ${err.message}`);
        }
      } else {
        setMediaError(
          "Failed to access camera/microphone due to unknown error."
        );
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

            peer.on("call", (call) => {
              console.log("Incoming call received.");
              setCallStatus("Incoming call received.");
              setIsStreaming(true); // 스트리밍 시작

              call.answer(stream);
              call.on("stream", (userVideoStream) => {
                console.log("Remote stream received successfully");
                if (callingVideoRef.current) {
                  callingVideoRef.current.srcObject = userVideoStream;
                  setCallStatus("Call connected");
                }
              });

              // call이 끊어질 때 처리
              call.on("close", () => {
                console.log("Call ended.");
                setCallStatus("Call ended");
                setIsStreaming(false);
                if (callingVideoRef.current) {
                  callingVideoRef.current.srcObject = null;
                }
              });
            });
          })
          .catch((err) => {
            console.error("Initial media setup failed:", err);
            setConnectionStatus("Media setup failed");
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
    setMyUniqueId(PEER_VIEWER_ID);
  }, []);

  // 컴포넌트 마운트 시 정보 표시
  useEffect(() => {
    if (typeof window !== "undefined") {
      showConnectionInfo();
    }
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
          {isStreaming ? (
            <>
              <h2 className="text-xl font-semibold mb-2">Camera Preview</h2>
              <div className="aspect-video flex-shrink-0">
                <video
                  className="w-full h-full rounded-lg object-cover"
                  playsInline
                  ref={callingVideoRef}
                  autoPlay
                  muted
                />
              </div>
            </>
          ) : receivedVideoUrl ? (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">
                Scan to view your Dolly Zoom
              </h2>
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
              <p className="text-gray-300 text-center">
                Follow the instructions on the left and start recording from the
                camera app.
                <br />
                Your creation will appear here once complete.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeerPage;
