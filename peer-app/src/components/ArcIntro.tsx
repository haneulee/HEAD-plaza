interface Props {
  onNext: () => void;
}

export const ArcIntro = ({ onNext }: Props) => {
  return (
    <div className="relative aspect-video flex-shrink-0 overflow-hidden">
      <video
        className="w-full h-full rounded-lg object-cover opacity-50"
        autoPlay
        loop
        muted
        playsInline
        src="/sample/arc shot - matrix.mov"
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = 0.5;
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <h1 className="text-8xl font-bold mb-4">Action!</h1>
        <p className="text-2xl mb-2">Make your arc shot</p>
        <p className="text-xl">Touch the camera screen to start</p>
      </div>
    </div>
  );
};
