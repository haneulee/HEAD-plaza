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

    // Track if component is mounted
    let isMounted = true;

    // MediaSource 설정
    mediaSourceRef.current = new MediaSource();
    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);
    }

    // Wait for WebSocket connection to be established
    ws.addEventListener("open", () => {
      console.log("WebSocket connection established");
    });

    ws.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });

    mediaSourceRef.current.addEventListener("sourceopen", () => {
      // Check if component is still mounted
      if (!isMounted) return;

      const sourceBuffer = mediaSourceRef.current?.addSourceBuffer(
        'video/webm; codecs="vp8,opus"'
      );
      if (sourceBuffer) {
        sourceBufferRef.current = sourceBuffer;
      }

      // Only set up message handler if WebSocket is connected
      if (ws.readyState === WebSocket.OPEN) {
        setupMessageHandler();
      } else {
        // If not connected yet, wait for the connection
        ws.addEventListener("open", setupMessageHandler);
      }
    });

    function setupMessageHandler() {
      ws.onmessage = async (event) => {
        // Check if component is still mounted and references are valid
        if (!isMounted || !sourceBufferRef.current || !mediaSourceRef.current)
          return;

        if (event.data instanceof ArrayBuffer && sourceBufferRef.current) {
          try {
            // Check if the SourceBuffer is still attached to the MediaSource
            if (
              !sourceBufferRef.current.updating &&
              mediaSourceRef.current.readyState === "open"
            ) {
              sourceBufferRef.current.appendBuffer(event.data);
            }
          } catch (e) {
            console.error("Error appending buffer:", e);
          }
        }
      };
    }

    return () => {
      // Mark component as unmounted
      isMounted = false;

      // Only close if the connection is established or in the process of connecting
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }

      if (sourceBufferRef.current && mediaSourceRef.current) {
        try {
          if (mediaSourceRef.current.readyState === "open") {
            mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
          }
        } catch (e) {
          console.error("Error cleaning up source buffer:", e);
        }
      }
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
