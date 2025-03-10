"use client";

import { FC } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const DollyZoomResultContent: FC = () => {
  const searchParams = useSearchParams();
  const videoURL = searchParams.get("video");

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Your Dolly Zoom Attempt</h1>

        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Your Recording</h2>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {videoURL && (
              <video
                controls
                loop
                autoPlay
                className="w-full h-full object-cover"
                src={videoURL}
              />
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">About Dolly Zoom</h2>
            <div className="bg-gray-800 p-6 rounded-lg mb-8">
              <p className="text-gray-300 leading-relaxed">
                The dolly zoom is a powerful cinematic technique that creates a
                disorienting effect by simultaneously moving the camera while
                adjusting the lens zoom. As the camera physically moves forward
                or backward (dolly), the zoom lens moves in the opposite
                direction, maintaining the subject's size while dramatically
                warping the background perspective.
              </p>
            </div>

            <h2 className="text-xl font-semibold mb-4">Tips for Improvement</h2>
            <div className="bg-gray-800 p-6 rounded-lg">
              <ul className="space-y-4 text-gray-300">
                <li>• Keep the subject centered in frame</li>
                <li>• Move the camera smoothly along the track</li>
                <li>• Coordinate your zoom with your movement</li>
                <li>• Try different speeds to find the sweet spot</li>
                <li>• Practice maintaining consistent movement speed</li>
                <li>• Experiment with both push-in and pull-out techniques</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 메인 페이지 컴포넌트
const DollyZoomResult: FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DollyZoomResultContent />
    </Suspense>
  );
};

export default DollyZoomResult;
