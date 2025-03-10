"use client";

import { FC, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

const DollyZoomResult: FC = () => {
  const searchParams = useSearchParams();
  const videoURL = searchParams.get("video");

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Your Dolly Zoom Attempt</h1>

        <div className="grid grid-cols-2 gap-8">
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
          </div>

          <div className="flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Tips for Improvement</h2>
            <div className="bg-gray-800 p-6 rounded-lg">
              <ul className="space-y-4 text-gray-300">
                <li>• Keep the subject centered in frame</li>
                <li>• Move the camera smoothly along the track</li>
                <li>• Coordinate your zoom with your movement</li>
                <li>• Try different speeds to find the sweet spot</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DollyZoomResult;
