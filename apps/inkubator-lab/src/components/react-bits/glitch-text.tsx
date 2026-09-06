"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import "./glitch-text.css";

export interface GlitchTextProps {
  text: string;
  className?: string;
  colors?: string[];
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  radius?: number;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  fadeIn?: boolean;
  autoFit?: boolean;
}

interface Char {
  char: string;
  cx: number;
  cy: number;
  color: string;
  layer: number;
  r: number;
  alpha: number;
  dx: number;
  dy: number;
  fadeAlpha: number;
  charIndex: number;
}

interface Pointer {
  x: number;
  y: number;
  r: number;
}

const GlitchText: React.FC<GlitchTextProps> = ({
  text = "Glitchy on hover.",
  className = "",
  colors = ["#00ffff", "#ff00ff", "#ffff00"],
  textColor,
  fontSize = 80,
  fontWeight = "600",
  radius = 250,
  letterSpacing = -1,
  lineHeight = 1.5,
  textAlign = "center",
  fadeIn = false,
  autoFit = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const charsRef = useRef<Char[]>([]);
  const pointerRef = useRef<Pointer>({ x: 0, y: 0, r: radius });
  const textLengthRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const animateRef = useRef<(() => void) | null>(null);
  const frameCountRef = useRef<number>(0);
  const dprRef = useRef<number>(1);
  const computedFontSizeRef = useRef<number>(fontSize);
  const [isDark, setIsDark] = useState(false);

  const measureText = useCallback(
    (ctx: CanvasRenderingContext2D, str: string): number => {
      return ctx.measureText(str).width;
    },
    [],
  );

  const dist = useCallback(
    (x1: number, y1: number, x2: number, y2: number): number => {
      return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    },
    [],
  );

  const getAngle = useCallback(
    (x1: number, y1: number, x2: number, y2: number): number => {
      return Math.atan2(y2 - y1, x2 - x1);
    },
    [],
  );

  const calculateFitFontSize = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      content: string,
      canvasWidth: number,
      canvasHeight: number,
    ): number => {
      const dpr = dprRef.current;
      const padding = 40 * dpr;
      const availableWidth = canvasWidth - padding * 2;
      const availableHeight = canvasHeight - padding * 2;

      const manualLines = content.split(" | ");

      let minSize = 10 * dpr;
      let maxSize = fontSize * dpr;
      let optimalSize = minSize;

      while (minSize <= maxSize) {
        const testSize = Math.floor((minSize + maxSize) / 2);
        ctx.font = `${fontWeight} ${testSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

        let fits = true;
        let totalHeight = 0;
        const lineH = testSize * lineHeight;

        for (const line of manualLines) {
          const lineWidth = measureText(ctx, line);
          if (lineWidth > availableWidth) {
            fits = false;
            break;
          }
          totalHeight += lineH;
        }

        if (fits && totalHeight <= availableHeight) {
          optimalSize = testSize;
          minSize = testSize + 1;
        } else {
          maxSize = testSize - 1;
        }
      }

      return optimalSize / dpr;
    },
    [fontWeight, fontSize, lineHeight, measureText],
  );

  const initChars = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      canvasWidth: number,
      canvasHeight: number,
    ) => {
      const chars: Char[] = [];
      const dpr = dprRef.current;

      let effectiveFontSize = fontSize;
      if (autoFit) {
        effectiveFontSize = calculateFitFontSize(
          ctx,
          text,
          canvasWidth,
          canvasHeight,
        );
      }
      computedFontSizeRef.current = effectiveFontSize;

      ctx.font = `${fontWeight} ${effectiveFontSize * dpr}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = "middle";

      const mainColor = textColor ?? (isDark ? "#ffffff" : "#000000");
      const allColors = [...colors, mainColor];

      let globalCharIndex = 0;
      for (let colorIndex = 0; colorIndex < allColors.length; colorIndex++) {
        let layer = 1;
        if (colorIndex === 0) layer = 0.5;
        else if (colorIndex === 1) layer = 0.7;
        else if (colorIndex === allColors.length - 1) layer = 0.6;

        const dpr = dprRef.current;
        const strs = text.split(" | ");
        const textLengths = strs.map((str) => measureText(ctx, str));
        const maxTextLength = Math.max(...textLengths);
        textLengthRef.current = maxTextLength;

        const textHeight = measureText(ctx, "M") * lineHeight;
        const isSingleLine = strs.length === 1;

        for (let i = 0; i < strs.length; i++) {
          let ww = 0;
          for (let j = 0; j < strs[i].length; j++) {
            const charWidth = measureText(ctx, strs[i][j]);
            let xx: number;

            if (textAlign === "left") {
              xx = x - maxTextLength / 2 + ww;
            } else if (textAlign === "right") {
              xx = x + maxTextLength / 2 - textLengths[i] + ww;
            } else {
              xx = x - textLengths[i] / 2 + ww;
            }

            const yy = isSingleLine
              ? y
              : i === 0
                ? y - textHeight / 2
                : y + textHeight / 2;
            chars.push({
              char: strs[i][j],
              cx: Math.round(xx),
              cy: Math.round(yy),
              color: allColors[colorIndex],
              layer: layer,
              r: 0,
              alpha: 0,
              dx: Math.round(xx),
              dy: Math.round(yy),
              fadeAlpha: fadeIn ? 0 : 1,
              charIndex: globalCharIndex,
            });
            ww += charWidth + letterSpacing * dpr;
          }
          if (colorIndex === 0) globalCharIndex++;
        }
      }

      return chars;
    },
    [
      colors,
      textColor,
      isDark,
      fontSize,
      fontWeight,
      measureText,
      letterSpacing,
      lineHeight,
      textAlign,
      fadeIn,
      autoFit,
      calculateFitFontSize,
    ],
  );

  const renderChar = useCallback(
    (char: Char, pointer: Pointer) => {
      const dis = dist(pointer.x, pointer.y, char.cx, char.cy);
      if (dis < pointer.r) {
        char.alpha = getAngle(pointer.x, pointer.y, char.cx, char.cy) + Math.PI;
        char.r = (char.layer * dis * (pointer.r - dis)) / pointer.r;
        char.dx += (char.cx + char.r * Math.cos(char.alpha) - char.dx) * 0.2;
        char.dy += (char.cy + char.r * Math.sin(char.alpha) - char.dy) * 0.2;
      } else {
        char.dx += (char.cx - char.dx) * 0.2;
        char.dy += (char.cy - char.dy) * 0.2;
      }
    },
    [dist, getAngle],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, chars: Char[]) => {
      const mainColor = textColor ?? (isDark ? "#ffffff" : "#000000");
      const allColors = [...colors, mainColor];

      ctx.globalCompositeOperation = isDark ? "lighten" : "darken";
      for (let i = 0; i < colors.length; i++) {
        for (let j = 0; j < chars.length; j++) {
          if (chars[j].color === allColors[i]) {
            const alpha = chars[j].fadeAlpha;
            if (alpha > 0) {
              ctx.globalAlpha = alpha;
              ctx.fillStyle = allColors[i];
              ctx.fillText(chars[j].char, chars[j].dx, chars[j].dy);
            }
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      for (let j = 0; j < chars.length; j++) {
        if (chars[j].color === mainColor) {
          const alpha = chars[j].fadeAlpha;
          if (alpha > 0) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = mainColor;
            ctx.fillText(chars[j].char, chars[j].dx, chars[j].dy);
          }
        }
      }

      ctx.globalAlpha = 1;
    },
    [colors, isDark, textColor],
  );

  useEffect(() => {
    const animate = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;

      const chars = charsRef.current;
      const pointer = pointerRef.current;
      const textLength = textLengthRef.current;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (fadeIn) {
        frameCountRef.current++;
        chars.forEach((char) => {
          if (char.fadeAlpha < 1) {
            const staggerDelay = char.charIndex * 3;
            const fadeSpeed = 0.005;

            if (frameCountRef.current > staggerDelay) {
              char.fadeAlpha = Math.min(1, char.fadeAlpha + fadeSpeed);
            }
          }
        });
      }

      if (
        Math.abs(pointer.x - centerX) < textLength &&
        Math.abs(pointer.y - centerY) < 0.7 * textLength
      ) {
        chars.forEach((char) => renderChar(char, pointer));
      } else {
        chars.forEach((char) => {
          char.dx += (char.cx - char.dx) * 0.2;
          char.dy += (char.cy - char.dy) * 0.2;
        });
      }

      draw(ctx, chars);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animateRef.current = animate;
  }, [renderChar, draw, isDark, fadeIn]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    pointerRef.current.x = -9999;
    pointerRef.current.y = -9999;
    pointerRef.current.r = radius * dpr;
    frameCountRef.current = 0;

    charsRef.current = initChars(
      ctx,
      text,
      centerX,
      centerY,
      canvas.width,
      canvas.height,
    );

    if (animateRef.current) {
      animateRef.current();
    }
  }, [text, radius, initChars]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = dprRef.current;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = (e.clientX - rect.left) * dpr;
    pointerRef.current.y = (e.clientY - rect.top) * dpr;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = dprRef.current;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current.x = (e.touches[0].clientX - rect.left) * dpr;
    pointerRef.current.y = (e.touches[0].clientY - rect.top) * dpr;
  }, []);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const canvas = canvasRef.current;
    if (!canvas) {
      observer.disconnect();
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      observer.disconnect();
      return;
    }

    ctxRef.current = ctx;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    pointerRef.current = {
      x: -9999,
      y: -9999,
      r: radius * dpr,
    };

    setTimeout(() => {
      charsRef.current = initChars(
        ctx,
        text,
        centerX,
        centerY,
        canvas.width,
        canvas.height,
      );

      setTimeout(() => {
        if (animateRef.current) {
          animateRef.current();
        }
      }, 50);
    }, 10);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(handleResize, 100);
    });
    resizeObserver.observe(canvas);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      resizeObserver.disconnect();
      observer.disconnect();
    };
  }, [text, radius, initChars, handleMouseMove, handleTouchMove, handleResize]);

  return (
    <div className={`glitch-text-container ${className}`}>
      <canvas
        ref={canvasRef}
        className="glitch-text-canvas glitch-text-canvas--sharp"
      />
    </div>
  );
};

GlitchText.displayName = "GlitchText";

export default GlitchText;
