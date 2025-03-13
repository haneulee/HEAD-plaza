interface Props {
  onNext: () => void;
}

export const DollyUserGuide = ({ onNext }: Props) => {
  return (
    <div className="relative aspect-video flex-shrink-0 mb-4">
      <video
        className="w-full h-full rounded-lg object-cover"
        autoPlay
        muted
        playsInline
        src="/guide/dolly-user-guide.mp4" // user guide video
      />
    </div>
  );
};
