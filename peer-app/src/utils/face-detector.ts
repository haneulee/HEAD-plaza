import * as blazeface from "@tensorflow-models/blazeface";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as tf from "@tensorflow/tfjs";

export class FaceDetector {
  private faceModel: blazeface.BlazeFaceModel | null = null;
  private objectModel: cocoSsd.ObjectDetection | null = null;

  constructor() {
    // 생성자에서 initModel 호출 제거
  }

  public async initModel() {
    try {
      // 두 모델 병렬로 로드
      [this.faceModel, this.objectModel] = await Promise.all([
        blazeface.load(),
        cocoSsd.load(),
      ]);
    } catch (error) {
      console.error("Model loading failed:", error);
    }
  }

  public async detect(video: HTMLVideoElement) {
    if (!this.faceModel || !this.objectModel) {
      throw new Error("Models are not loaded yet");
    }

    const tfVideo = tf.browser.fromPixels(video);

    try {
      // 얼굴과 객체 감지를 병렬로 실행
      const [faces, objects] = await Promise.all([
        this.faceModel.estimateFaces(tfVideo, false),
        this.objectModel.detect(tfVideo),
      ]);

      // 관심 있는 객체 필터링 (장난감, 인형 등)
      const relevantObjects = objects.filter((obj) =>
        [
          "teddy bear",
          "toy",
          "doll",
          "sports ball",
          "cell phone",
          "remote",
        ].includes(obj.class)
      );

      // 얼굴이나 관련 객체가 있으면 true
      const hasDetection =
        faces.some((face) => {
          const prob =
            face.probability instanceof tf.Tensor
              ? face.probability.dataSync()[0]
              : face.probability;
          return (prob ?? 0) > 0.9;
        }) || relevantObjects.some((obj) => obj.score > 0.7);

      return hasDetection;
    } finally {
      tfVideo.dispose();
    }
  }
}
