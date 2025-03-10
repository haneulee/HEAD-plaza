"use client";

import { FC, useEffect, useState } from "react";

import { useParams } from "next/navigation";

const DollyZoomResult: FC = () => {
  const { videoId } = useParams();
  const videoURL = `${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Your Dolly Zoom Attempt</h1>

        <div className="flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Your Recording</h2>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              controls
              loop
              autoPlay
              className="w-full h-full object-cover"
              src={videoURL}
            />
          </div>
          {/* ... rest of the component ... */}
        </div>
      </div>
    </div>
  );
};

export default DollyZoomResult;
