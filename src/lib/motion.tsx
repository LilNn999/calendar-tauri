// src/lib/motion.tsx
// framer-motion 轻量替代：仅支持本项目用到的 opacity/scale/x/y/width/rotate 动画子集。
// 进入动画用 CSS keyframes（globals.css 中定义），退出动画退化为直接卸载。
import React from "react";

type AnimValue = {
  opacity?: number;
  scale?: number;
  x?: number | string;
  y?: number | string;
  width?: number | string;
  rotate?: number;
};

function toCss(v?: AnimValue): React.CSSProperties {
  if (!v) return {};
  const css: React.CSSProperties = {};
  if (v.opacity !== undefined) css.opacity = v.opacity;
  const transforms: string[] = [];
  if (v.scale !== undefined) transforms.push(`scale(${v.scale})`);
  if (v.x !== undefined) transforms.push(`translateX(${typeof v.x === "number" ? `${v.x}px` : v.x})`);
  if (v.y !== undefined) transforms.push(`translateY(${typeof v.y === "number" ? `${v.y}px` : v.y})`);
  if (v.rotate !== undefined) transforms.push(`rotate(${v.rotate}deg)`);
  if (transforms.length > 0) css.transform = transforms.join(" ");
  if (v.width !== undefined) css.width = typeof v.width === "number" ? `${v.width}px` : v.width;
  return css;
}

function pickAnimation(initial?: AnimValue, animate?: AnimValue): string | undefined {
  if (!initial || !animate) return undefined;
  if (animate.x === "100%") return "fm-slide-in-right";
  if (animate.width !== undefined && initial.width === 0) return "fm-expand";
  if (animate.opacity !== undefined && initial.opacity === 0 && animate.x === 0 && (initial.x as number) > 0) {
    return "fm-toast-in";
  }
  if ((animate.y as number) < 0 || (initial.y as number) < 0) return "fm-pop-top-in";
  if (initial.y !== undefined || initial.scale !== undefined) return "fm-pop-in";
  if (animate.opacity !== undefined && initial.opacity === 0) return "fm-fade-in";
  return undefined;
}

const MotionTag = (tag: string) =>
  function MotionComponent(props: Record<string, unknown>) {
    const { initial, animate, exit, transition, style, children, ...rest } = props;
    const target = (animate ?? {}) as AnimValue;
    const init = initial as AnimValue | undefined;
    const animClass = pickAnimation(init, target);
    const css = { ...toCss(target), ...(style as React.CSSProperties | undefined) };
    const merged: React.CSSProperties = animClass
      ? { ...css, animation: `${animClass} 0.2s ease-out` }
      : css;
    return React.createElement(tag, { ...rest, style: merged }, children as React.ReactNode);
  };

// 缓存各标签对应的组件引用：避免每次渲染生成新组件类型导致 React 判定为不同组件而重挂载
// （重挂载会让进场动画反复播放，表现为侧栏闪回）
const motionCache = new Map<string, React.ComponentType<Record<string, unknown>>>();
export const motion = new Proxy(
  {},
  {
    get: (_t, tag) => {
      if (typeof tag !== "string") return undefined;
      if (!motionCache.has(tag)) motionCache.set(tag, MotionTag(tag));
      return motionCache.get(tag);
    },
  },
) as Record<string, React.ComponentType<Record<string, unknown>>>;

export function AnimatePresence(props: { children?: React.ReactNode; [key: string]: unknown }) {
  return <>{props.children}</>;
}

export default motion;