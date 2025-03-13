"use client";

import { useCallback, useEffect, useState } from "react";

import { ArcIntro } from "@/components/ArcIntro";
import { ArcRecording } from "@/components/ArcRecording";
import { ArcUserGuide } from "@/components/ArcUserGuide";
import { DollyEnding } from "@/components/DollyEnding";
import { DollyIntro } from "@/components/DollyIntro";
import { DollyRecording } from "@/components/DollyRecording";
import { DollyUserGuide } from "@/components/DollyUserGuide";

const DollySimple = () => {
  const [currentStep, setCurrentStep] = useState<
    "intro" | "guide" | "recording" | "ending"
  >("intro");
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>("");

  // 마우스 움직임 감지
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (currentStep === "intro") {
        setCurrentStep("guide");
      }

      // guide 단계에서 마우스가 오른쪽 끝에 도달하면 recording으로 전환
      if (currentStep === "guide") {
        const screenWidth = window.innerWidth;
        if (e.clientX >= screenWidth - 10) {
          setCurrentStep("recording");
        }
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
        <ArcIntro onNext={() => setCurrentStep("guide")} />
      )}
      {currentStep === "guide" && (
        <ArcUserGuide onNext={() => setCurrentStep("recording")} />
      )}
      {currentStep === "recording" && (
        <ArcRecording onRecordingComplete={handleRecordingComplete} />
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
