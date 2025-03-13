interface Props {
  onNext: () => void;
}

export const DollyIntro = ({ onNext }: Props) => {
  return (
    <div className="relative aspect-video flex-shrink-0 mb-4">
      <video
        className="w-full h-full rounded-lg object-cover opacity-50"
        autoPlay
        loop
        muted
        playsInline
        src="/sample/dolly zoom - jaws.mov"
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = 0.5;
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <h1 className="text-8xl font-bold mb-4">Action!</h1>
        <p className="text-2xl mb-2">Make your dolly zoom</p>
        <p className="text-xl">Move the camera to start</p>
      </div>
    </div>
  );
};
