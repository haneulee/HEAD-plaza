import { FC } from "react";
import Link from "next/link";

const Home: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl font-bold">
        Action! - Cinematic Shot Recreation
      </h1>
      <p className="mt-4 text-gray-600">
        Select a camera technique to recreate:
      </p>
      <div className="mt-6 space-y-4">
        <Link
          href="/dolly-zoom"
          className="block bg-blue-500 text-white px-6 py-3 rounded"
        >
          Dolly Zoom
        </Link>
        <Link
          href="/circle-shot"
          className="block bg-green-500 text-white px-6 py-3 rounded"
        >
          Circle Shot
        </Link>
        <Link
          href="/zero-gravity"
          className="block bg-red-500 text-white px-6 py-3 rounded"
        >
          Zero Gravity Shot
        </Link>
      </div>
    </div>
  );
};

export default Home;
