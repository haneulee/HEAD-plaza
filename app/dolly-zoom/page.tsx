import { FC, useEffect, useRef } from "react";

import CameraRecorder from "../../components/CameraRecorder";
import { io } from "socket.io-client";

const DollyZoom: FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<any>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    // 웹소켓 연결
    socketRef.current = io(process.env.NEXT_PUBLIC_WS_URL);

    // PeerConnection 생성
    peerRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    if (peerRef.current && videoRef.current) {
      peerRef.current.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      peerRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("candidate", event.candidate);
        }
      };
    }

    socketRef.current.on("offer", async (offer: RTCSessionDescriptionInit) => {
      if (!peerRef.current) return;

      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socketRef.current?.emit("answer", answer);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Create Dolly Zoom Effect</h1>

        <div className="mb-8">
          <p className="text-lg leading-relaxed text-gray-300">
            The Dolly Zoom is a cinematic technique that involves moving the
            camera towards or away from a subject while simultaneously zooming
            in the opposite direction. This creates a distinctive visual effect
            where the subject remains the same size while the background
            dramatically changes in perspective.
          </p>
          <p className="text-lg mt-4 leading-relaxed text-gray-300">
            First popularized in Alfred Hitchcock&apos;s &quot;Vertigo&quot;
            (hence also known as the &quot;Vertigo Effect&quot;), this technique
            has been used in countless classic films like &quot;Jaws&quot; and
            &quot;Goodfellas&quot; to convey psychological distress, dramatic
            realizations, or moments of intense tension.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Example Shot: Jaws</h2>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                controls
                loop
                autoPlay
                className="w-full h-full object-cover"
                src="/video/dolly zoom - jaws.mov"
              />
            </div>
            <div className="mt-4 p-4 bg-gray-800 rounded-lg">
              <h3 className="font-medium text-lg mb-2">How to Recreate:</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Push camera along the track</li>
                <li>Follow the pace of the zoom in screen</li>
              </ol>
            </div>
          </div>

          <div className="flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Camera</h2>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {/* <CameraRecorder /> */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: "100%", maxWidth: "800px" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DollyZoom;
