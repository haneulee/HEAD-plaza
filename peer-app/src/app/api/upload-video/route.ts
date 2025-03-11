import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

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

    // 영상을 저장할 디렉토리 생성
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // 파일명 생성 (타임스탬프 사용)
    const fileName = `video-${Date.now()}.webm`;
    const filePath = path.join(uploadDir, fileName);

    // 영상 파일 저장
    const arrayBuffer = await video.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    await fs.writeFile(filePath, uint8Array);

    // 클라이언트에서 접근 가능한 URL 반환
    const videoUrl = `/uploads/${fileName}`;

    return NextResponse.json({ videoUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}
