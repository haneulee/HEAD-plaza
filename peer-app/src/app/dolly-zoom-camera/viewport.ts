export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export class Viewport {
  private container: HTMLElement;
  private targetZoom: number = 1;
  private currentZoom: number = 1;
  private zoomSpeed: number = 0.05;
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.animate = this.animate.bind(this);
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  public updateFaceDetection(faceDetected: boolean) {
    this.targetZoom = faceDetected ? 1.5 : 1.0;
    this.zoomSpeed = faceDetected ? 0.05 : 0.2;
  }

  public animate() {
    // 부드러운 줌 효과를 위한 보간
    this.currentZoom += (this.targetZoom - this.currentZoom) * this.zoomSpeed;

    // 비디오 요소에 scale 변환 적용
    const video = this.container.querySelector("video");
    if (video) {
      video.style.transform = `scale(${this.currentZoom})`;
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
