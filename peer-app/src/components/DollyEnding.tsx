import { useEffect, useRef } from "react";

import { QRCodeSVG } from "qrcode.react";

interface Props {
  recordedVideoUrl: string;
  onReset?: () => void;
}

export const DollyEnding = ({ recordedVideoUrl, onReset }: Props) => {
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const sampleVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 비디오들 자동 재생
    if (userVideoRef.current) {
      userVideoRef.current
        .play()
        .catch((err) => console.error("Failed to play user video:", err));
    }
    if (sampleVideoRef.current) {
      sampleVideoRef.current
        .play()
        .catch((err) => console.error("Failed to play sample video:", err));
    }

    // 1분 후 자동으로 intro로 돌아가는 타이머 설정
    timerRef.current = setTimeout(() => {
      console.log("Auto-returning to intro after 1 minute");
      if (onReset) {
        onReset();
      }
    }, 60000); // 60초 = 1분

    // 컴포넌트가 언마운트될 때 타이머 정리
    return () => {
      console.log("DollyEnding component unmounting");
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [onReset]);

  return (
    <div className="flex flex-col h-screen bg-black text-white p-8">
      {/* 제목 */}
      <h1 className="text-4xl text-center mb-8">Here is your Dolly Zoom</h1>

      {/* 비디오 컨테이너 */}
      <div className="flex-1 flex justify-between gap-8 mb-8">
        {/* 왼쪽: 사용자 영상 */}
        <div className="flex-1 flex flex-col">
          <video
            ref={userVideoRef}
            className="w-full h-full object-cover rounded-lg"
            src={recordedVideoUrl}
            loop
            muted
            playsInline
            controls
          />
          <p className="text-2xl text-center mt-4">You, 2025</p>
        </div>

        {/* 오른쪽: 샘플 영상 */}
        <div className="flex-1 flex flex-col">
          <video
            ref={sampleVideoRef}
            className="w-full h-full object-cover rounded-lg"
            src="/sample/dolly zoom - jaws.mov"
            loop
            muted
            playsInline
            controls
          />
          <p className="text-2xl text-center mt-4">Spielberg 1975</p>
        </div>
      </div>

      {/* QR 코드와 다운로드 텍스트 - 화면 하단 왼쪽에 배치하고 여백 추가 */}
      <div className="flex items-center gap-6 mb-16">
        <QRCodeSVG
          value={recordedVideoUrl}
          size={100}
          level="H"
          className="bg-white p-2 rounded"
        />
        <div className="flex flex-col">
          <p className="text-xl mb-2">Scan to see your movie</p>
        </div>
      </div>
    </div>
  );
};
