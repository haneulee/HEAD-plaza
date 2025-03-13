interface Props {
  onNext: () => void;
}

export const DollyUserGuide = ({ onNext }: Props) => {
  const handleVideoLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    e.currentTarget
      .play()
      .catch((err) => console.error("Video playback failed:", err));
  };

  return (
    <div className="relative aspect-video flex-shrink-0 mb-4">
      <video
        className="w-full h-full rounded-lg object-cover"
        autoPlay
        muted
        playsInline
        onLoadedData={handleVideoLoaded}
        src="/guide/dolly-user-guide.mp4" // user guide video
      />
    </div>
  );
};
