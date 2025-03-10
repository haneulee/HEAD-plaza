"use client";

import { FC, useEffect, useRef, useState } from "react";

import { QRCodeSVG } from "qrcode.react";

const CameraRecorder: FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/stream`);
    ws.binaryType = "arraybuffer";

    // MediaSource 설정
    mediaSourceRef.current = new MediaSource();
    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);
    }

    mediaSourceRef.current.addEventListener("sourceopen", () => {
      const sourceBuffer = mediaSourceRef.current?.addSourceBuffer(
        'video/webm; codecs="vp8,opus"'
      );
      if (sourceBuffer) {
        sourceBufferRef.current = sourceBuffer;
      }

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer && sourceBufferRef.current) {
          try {
            if (!sourceBufferRef.current.updating) {
              sourceBufferRef.current.appendBuffer(event.data);
            }
          } catch (e) {
            console.error("Error appending buffer:", e);
          }
        }
      };
    });

    return () => {
      if (sourceBufferRef.current) {
        try {
          mediaSourceRef.current?.removeSourceBuffer(sourceBufferRef.current);
        } catch (e) {
          console.error("Error cleaning up source buffer:", e);
        }
      }
      ws.close();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

export default CameraRecorder;
