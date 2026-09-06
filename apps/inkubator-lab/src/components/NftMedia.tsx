import {useEffect, useRef, useState} from 'react';

type NftMediaProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

const RESPONSIVE_WIDTHS = [420, 640, 900];

function isVideo(src: string) {
  return /\.(mp4|webm|mov)(?:\?|$)/i.test(src);
}

function isGif(src: string) {
  return /\.gif(?:\?|$)/i.test(src);
}

function withQuery(src: string, key: string, value: string | number) {
  try {
    const url = new URL(src);
    url.searchParams.set(key, String(value));
    return url.toString();
  } catch {
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
  }
}

function sized(src: string, width: number) {
  return withQuery(src, 'w', width);
}

function poster(src: string, width = 900) {
  return withQuery(sized(src, width), 'frame-time', 1);
}

function srcSetFor(src: string, staticFrame: boolean) {
  return RESPONSIVE_WIDTHS.map((width) => `${staticFrame ? poster(src, width) : sized(src, width)} ${width}w`).join(', ');
}

export default function NftMedia({src, alt, className = '', priority = false}: NftMediaProps) {
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [animate, setAnimate] = useState(() => !isGif(src));

  useEffect(() => {
    setFailed(false);
    setAnimate(!isGif(src));
  }, [src]);

  useEffect(() => {
    if (!isGif(src)) return;
    const node = mediaRef.current;
    if (!node) return;

    let timer = 0;
    const start = () => setAnimate(true);

    if (priority) {
      const wake = () => {
        window.clearTimeout(timer);
        start();
      };
      timer = window.setTimeout(start, 2400);
      window.addEventListener('pointerdown', wake, {once: true, passive: true});
      window.addEventListener('touchstart', wake, {once: true, passive: true});
      window.addEventListener('keydown', wake, {once: true});
      window.addEventListener('scroll', wake, {once: true, passive: true});
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('pointerdown', wake);
        window.removeEventListener('touchstart', wake);
        window.removeEventListener('keydown', wake);
        window.removeEventListener('scroll', wake);
      };
    }

    if (typeof IntersectionObserver === 'undefined') {
      timer = window.setTimeout(start, 200);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      timer = window.setTimeout(start, 120);
      observer.disconnect();
    }, {rootMargin: '320px 0px'});
    observer.observe(node);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [priority, src]);

  if (failed) {
    return <div className={`d3-media-fallback ${className}`} role="img" aria-label={`${alt} unavailable`}><span>MEDIA SIGNAL LOST</span></div>;
  }

  if (isVideo(src)) {
    return (
      <video
        ref={(node) => { mediaRef.current = node; }}
        className={className}
        src={src}
        aria-label={alt}
        autoPlay={priority}
        muted
        loop
        playsInline
        preload={priority ? 'metadata' : 'none'}
        width={900}
        height={900}
        onError={() => setFailed(true)}
      />
    );
  }

  const staticFrame = isGif(src) && !animate;
  const displaySrc = staticFrame ? poster(src) : src;

  return (
    <img
      ref={(node) => { mediaRef.current = node; }}
      className={className}
      src={displaySrc}
      srcSet={srcSetFor(src, staticFrame)}
      sizes="(max-width: 720px) calc(100vw - 36px), (max-width: 1100px) 46vw, 500px"
      alt={alt}
      width={900}
      height={900}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
