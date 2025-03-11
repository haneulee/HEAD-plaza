import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const runtime = "nodejs";

// Cloudinary 응답 타입 정의
type CloudinaryResponse = {
  secure_url: string;
};

const saveLocally = async (video: Blob): Promise<string> => {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const fileName = `video-${Date.now()}.webm`;
  const filePath = path.join(uploadDir, fileName);

  const arrayBuffer = await video.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  await fs.writeFile(filePath, uint8Array);

  return `/uploads/${fileName}`;
};

const saveToCloudinary = async (video: Blob): Promise<string> => {
  const arrayBuffer = await video.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await new Promise<CloudinaryResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "videos",
        transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result as CloudinaryResponse);
      }
    );

    const Readable = require("stream").Readable;
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    stream.pipe(uploadStream);
  });

  return result.secure_url;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const video = formData.get("video") as Blob;

    if (!video) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    const videoUrl =
      process.env.NODE_ENV === "development"
        ? await saveLocally(video)
        : await saveToCloudinary(video);

    return NextResponse.json({ videoUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}
