import { useEffect, useRef, useState } from "react";

import Peer from "peerjs";

interface Props {
  onRecordingComplete: (videoUrl: string) => void;
  isLoading?: boolean; // 로딩 상태 prop 추가
  stream?: MediaStream; // 스트림을 props로 받음
}

export const ArcRecording = ({
  onRecordingComplete,
  isLoading,
  stream,
}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callingVideoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // 스트림이 변경될 때마다 비디오 엘리먼트에 연결
  useEffect(() => {
    if (callingVideoRef.current && stream) {
      callingVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress =
        (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  return (
    <div className="relative h-screen">
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
        <div className="w-1/4 -mt-8">
          <video
            ref={videoRef}
            className="w-full h-full object-cover rounded-lg"
            autoPlay
            loop
            muted
            playsInline
            src="/sample/arc shot - matrix.mov"
            onTimeUpdate={handleTimeUpdate}
          />
        </div>

        {/* 하단 웹캠 영상 */}
        <div className="relative w-1/2">
          <video
            ref={callingVideoRef}
            className="rounded-lg"
            style={{
              transform: "rotate(-90deg)",
              objectFit: "cover",
              width: "150%", // 4:3 비율을 유지하면서 회전을 고려한 너비
              // height: "75%", // 4:3 비율을 유지하면서 회전을 고려한 높이
            }}
            autoPlay
            playsInline
            muted
          />
        </div>
      </div>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <img src="/loading.svg" alt="Loading..." className="w-16 h-16" />
        </div>
      )}
    </div>
  );
};
