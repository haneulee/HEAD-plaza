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

export default getPeerConfig;
