import {useState} from 'react';

type NftMediaProps = {
  src: string;
  alt: string;
  className?: string;
};

function isVideo(src: string) {
  return /\.(mp4|webm|mov)(?:\?|$)/i.test(src);
}

export default function NftMedia({src, alt, className = ''}: NftMediaProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={`d3-media-fallback ${className}`} role="img" aria-label={`${alt} unavailable`}><span>MEDIA SIGNAL LOST</span></div>;
  }

  if (isVideo(src)) {
    return (
      <video
        className={className}
        src={src}
        aria-label={alt}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      />
    );
  }

  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
