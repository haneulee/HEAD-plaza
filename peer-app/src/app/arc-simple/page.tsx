"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ArcEnding } from "@/components/ArcEnding";
import { ArcIntro } from "@/components/ArcIntro";
import { ArcRecording } from "@/components/ArcRecording";
import { ArcUserGuide } from "@/components/ArcUserGuide";
import Peer from "peerjs";
import { generateUniqueId } from "@/utils/generateUniqueId";
import getPeerConfig from "@/utils/getPeerConfig";

const ArcSimple = () => {
  const [currentStep, setCurrentStep] = useState<
    "intro" | "guide" | "recording" | "ending"
  >("intro");
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>("");
  const [remoteStream, setRemoteStream] = useState<MediaStream | undefined>();
  const [myUniqueId, setMyUniqueId] = useState<string>("");

  // URL에 ID 파라미터 추가하는 함수
  const updateUrlWithId = (id: string) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("id", id);
      window.history.replaceState({}, "", url.toString());
    }
  };

  useEffect(() => {
    // 고정 ID 대신 랜덤 ID 사용
    const newId = generateUniqueId();
    setMyUniqueId(newId);
    // URL에 ID 추가
    updateUrlWithId(newId);
  }, []);

  // PeerJS 설정
  useEffect(() => {
    if (!myUniqueId) return;

    const peerConfig = getPeerConfig();
    const peer = new Peer(myUniqueId, peerConfig);

    peer.on("connection", (conn) => {
      conn.on("data", (data: any) => {
        if (data.type === "start-guide" && currentStep === "intro") {
          setCurrentStep("guide");
        } else if (data.type === "recorded-video") {
          setRecordedVideoUrl(data.url);
          setCurrentStep("ending");
        }
      });
    });

    // 통화 수신 처리
    peer.on("call", (call) => {
      console.log("Incoming call received.");

      // 빈 스트림으로 응답 (screen 페이지는 카메라가 필요 없음)
      const emptyStream = new MediaStream();
      call.answer(emptyStream);

      // 원격 스트림 수신
      call.on("stream", (userVideoStream) => {
        console.log("Remote stream received successfully");
        setRemoteStream(userVideoStream);
      });

      call.on("close", () => {
        console.log("Call ended.");
        setRemoteStream(undefined);
      });
    });

    return () => {
      peer.destroy();
    };
  }, [myUniqueId, currentStep]);

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
        <ArcRecording
          onRecordingComplete={handleRecordingComplete}
          stream={remoteStream}
        />
      )}
      {currentStep === "ending" && (
        <ArcEnding recordedVideoUrl={recordedVideoUrl} onReset={handleReset} />
      )}
    </div>
  );
};

export default ArcSimple;
