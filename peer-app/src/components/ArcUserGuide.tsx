interface Props {
  onNext: () => void;
}

export const ArcUserGuide = ({ onNext }: Props) => {
  return (
    <div className="relative aspect-video flex-shrink-0 mb-4">
      <video
        className="w-full h-full rounded-lg object-cover"
        autoPlay
        muted
        playsInline
        src="/guide/arc-user-guide.mp4" // user guide video
        onEnded={onNext} // 비디오 재생이 끝나면 다음 단계로
      />
    </div>
  );
};
