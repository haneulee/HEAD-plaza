import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

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

    // Blob을 Buffer로 변환
    const arrayBuffer = await video.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cloudinary에 업로드
    const result = await new Promise<CloudinaryResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "video",
          folder: "videos",
          transformation: [
            { quality: "auto" }, // 자동 품질 최적화
            { fetch_format: "auto" }, // 최적의 포맷 선택
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as CloudinaryResponse);
        }
      );

      // Buffer를 스트림으로 변환하여 업로드
      const Readable = require("stream").Readable;
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);
      stream.pipe(uploadStream);
    });

    return NextResponse.json({
      videoUrl: result.secure_url,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}
