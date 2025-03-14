"use client";

import { useCallback, useEffect, useState } from "react";

import { DollyEnding } from "@/components/DollyEnding";
import { DollyIntro } from "@/components/DollyIntro";
import { DollyRecording } from "@/components/DollyRecording";

const DollySimple = () => {
  const [currentStep, setCurrentStep] = useState<
    "intro" | "recording" | "ending"
  >("intro");
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>("");

  // 마우스 움직임 감지
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (currentStep === "intro") {
        setCurrentStep("recording");
      }
    },
    [currentStep]
  );

  // 마우스 이벤트 핸들러는 별도의 useEffect로 분리
  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseMove]);

  const handleRecordingComplete = (videoUrl: string) => {
    console.log("Recording completed with URL:", videoUrl);
    setRecordedVideoUrl(videoUrl);
    setCurrentStep("ending");
  };

  // 리셋 함수 추가
  const handleReset = () => {
    setCurrentStep("intro");
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {currentStep === "intro" && (
        <DollyIntro onNext={() => setCurrentStep("recording")} />
      )}
      {currentStep === "recording" && (
        <DollyRecording onRecordingComplete={handleRecordingComplete} />
      )}
      {currentStep === "ending" && (
        <DollyEnding
          recordedVideoUrl={recordedVideoUrl}
          onReset={handleReset}
        />
      )}
    </div>
  );
};

export default DollySimple;
