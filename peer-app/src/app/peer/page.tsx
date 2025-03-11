"use client";

import { useEffect, useRef, useState } from "react";

import Peer from "peerjs";

const PeerPage = () => {
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const callingVideoRef = useRef<HTMLVideoElement>(null);

  const [peerInstance, setPeerInstance] = useState<Peer | null>(null);
  const [myUniqueId, setMyUniqueId] = useState<string>("");
  const [idToCall, setIdToCall] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    "environment"
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  const generateRandomString = () => Math.random().toString(36).substring(2);

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
          facingMode: facingMode,
        },
        audio: true,
      });

      // 스트림 저장
      setStream(stream);
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
              setStream(audioOnlyStream);
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
              setStream(lowResStream);
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

  const handleCall = () => {
    if (!peerInstance) return;

    safeGetUserMedia()
      .then((stream) => {
        const call = peerInstance.call(idToCall, stream);
        if (call) {
          call.on("stream", (userVideoStream) => {
            if (callingVideoRef.current) {
              callingVideoRef.current.srcObject = userVideoStream;
            }
          });
        }
      })
      .catch((err) => console.error("Call failed:", err));
  };

  const switchCamera = async () => {
    if (stream) {
      // 기존 트랙 중지
      stream.getTracks().forEach((track) => track.stop());
    }

    // 카메라 방향 전환
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacingMode);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
        },
        audio: true,
      });

      setStream(newStream);

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = newStream;
      }

      // PeerJS 연결이 있는 경우 새 스트림으로 업데이트
      if (peerInstance) {
        // 기존 연결에 새 스트림 적용 로직 추가 필요
      }
    } catch (err) {
      console.error("카메라 전환 실패:", err);
      setMediaError("카메라 전환에 실패했습니다.");
    }
  };

  // 디버깅 정보 표시 함수
  const showConnectionInfo = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const expectedWsProtocol = protocol === "https:" ? "wss:" : "ws:";

    setDebugInfo(`
      페이지 프로토콜: ${protocol}
      호스트: ${hostname}
      예상 WebSocket 프로토콜: ${expectedWsProtocol}
      PeerJS 연결 URL: ${expectedWsProtocol}//${hostname}:9000/myapp
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

    // 프로덕션 환경
    return {
      host: process.env.NEXT_PUBLIC_API_URL || "localhost", // Vercel 환경변수 사용
      port: 443,
      path: "/myapp",
      secure: true,
    };
  };

  // PeerJS 인스턴스 생성 시 설정 사용
  useEffect(() => {
    if (myUniqueId) {
      let peer: Peer;
      if (typeof window !== "undefined") {
        const peerConfig = getPeerConfig();

        peer = new Peer(myUniqueId, peerConfig);

        // 연결 이벤트 리스너 추가
        peer.on("open", (id) => {
          setDebugInfo(`PeerJS 연결 성공: ${id}`);
        });

        peer.on("error", (err) => {
          console.error("PeerJS 오류:", err);
          setDebugInfo(`PeerJS 오류: ${err.type}`);
          setMediaError(`PeerJS 연결 실패: ${err.type}`);
        });

        setPeerInstance(peer);

        safeGetUserMedia()
          .then((stream) => {
            if (myVideoRef.current) {
              myVideoRef.current.srcObject = stream;
            }

            peer.on("call", (call) => {
              call.answer(stream);
              call.on("stream", (userVideoStream) => {
                if (callingVideoRef.current) {
                  callingVideoRef.current.srcObject = userVideoStream;
                }
              });
            });
          })
          .catch((err) => console.error("Initial media setup failed:", err));
      }
      return () => {
        if (peer) {
          peer.destroy();
        }
      };
    }
  }, [myUniqueId]);

  useEffect(() => {
    setMyUniqueId(generateRandomString());
  }, []);

  // 컴포넌트 마운트 시 정보 표시
  useEffect(() => {
    if (typeof window !== "undefined") {
      showConnectionInfo();
    }
  }, []);

  return (
    <div className="flex flex-col justify-center items-center p-12">
      <p>your id : {myUniqueId}</p>
      {mediaError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {mediaError}
        </div>
      )}
      {debugInfo && (
        <div className="text-xs text-gray-500 mt-1 mb-2">{debugInfo}</div>
      )}
      <video className="w-72" playsInline ref={myVideoRef} autoPlay muted />
      <input
        className="text-black"
        placeholder="Id to call"
        value={idToCall}
        onChange={(e) => setIdToCall(e.target.value)}
      />
      <button
        onClick={handleCall}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
      >
        call
      </button>
      <button
        onClick={switchCamera}
        className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded mt-2 ml-2"
      >
        카메라 전환
      </button>
      <video className="w-72" playsInline ref={callingVideoRef} autoPlay />
    </div>
  );
};

export default PeerPage;
