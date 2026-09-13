"use client";

import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  /** Đẩy ra ngoài sau khi dừng gõ / blur / Enter — UI vẫn hiện chữ ngay. */
  onCommit: (next: string) => void;
  /** Mỗi lần gõ — luôn gọi SAU khi chữ đã vẽ (tránh đơ ô khi lọc nặng). */
  onLiveChange?: (next: string) => void;
  debounceMs?: number;
};

/**
 * Ô chữ / tìm kiếm: gõ và xóa thấy liền.
 * - flushSync set chữ local trước khi báo cha
 * - onLiveChange / commit trống lùi sau frame — không đè chữ đang gõ
 */
export const InstantTextInput = React.forwardRef<HTMLInputElement, Props>(
  function InstantTextInput(
    {
      value,
      onCommit,
      onLiveChange,
      debounceMs = 320,
      onBlur,
      onKeyDown,
      ...rest
    },
    ref
  ) {
    const [text, setText] = useState(String(value ?? ''));
    const lastCommitRef = useRef(String(value ?? ''));
    const liveEchoRef = useRef<string | null>(null);
    const textRef = useRef(text);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const liveRafRef = useRef<number | null>(null);
    const onCommitRef = useRef(onCommit);
    const onLiveRef = useRef(onLiveChange);
    onCommitRef.current = onCommit;
    onLiveRef.current = onLiveChange;
    textRef.current = text;

    useEffect(() => {
      const next = String(value ?? '');
      const local = textRef.current;

      if (next === local) {
        liveEchoRef.current = null;
        lastCommitRef.current = next;
        return;
      }

      if (liveEchoRef.current !== null) {
        if (next === liveEchoRef.current) {
          liveEchoRef.current = null;
          lastCommitRef.current = next;
          return;
        }
        // Parent xóa trắng / nút × — nhận lệnh
        if (next === '') {
          liveEchoRef.current = null;
          lastCommitRef.current = '';
          setText('');
          return;
        }
        // Value chậm (chưa kịp theo chữ đang gõ/xóa) → bỏ qua, giữ chữ local
        return;
      }

      lastCommitRef.current = next;
      setText(next);
    }, [value]);

    useEffect(
      () => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (liveRafRef.current != null) cancelAnimationFrame(liveRafRef.current);
      },
      []
    );

    const emitCommit = (next: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (next === lastCommitRef.current) return;
      lastCommitRef.current = next;
      // Giữ liveEcho đến khi parent bắt kịp value — tránh đè chữ đang gõ khi commit sớm
      liveEchoRef.current = next;
      onCommitRef.current(next);
    };

    const scheduleLive = (next: string) => {
      if (liveRafRef.current != null) cancelAnimationFrame(liveRafRef.current);
      liveRafRef.current = requestAnimationFrame(() => {
        liveRafRef.current = null;
        // Bỏ qua nếu user đã gõ tiếp / xóa tiếp
        if (textRef.current !== next) return;
        onLiveRef.current?.(next);
      });
    };

    return (
      <input
        {...rest}
        ref={ref}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          textRef.current = next;
          liveEchoRef.current = next;
          // Ép chữ lên DOM ngay — trước mọi việc nặng của cha
          flushSync(() => {
            setText(next);
          });
          scheduleLive(next);
          if (timerRef.current) clearTimeout(timerRef.current);
          if (!next.trim()) {
            // Xóa hết: commit sau paint (tránh đơ cùng lúc với flushSync)
            timerRef.current = setTimeout(() => emitCommit(next), 0);
            return;
          }
          timerRef.current = setTimeout(() => emitCommit(next), debounceMs);
        }}
        onBlur={(e) => {
          if (liveRafRef.current != null) {
            cancelAnimationFrame(liveRafRef.current);
            liveRafRef.current = null;
            onLiveRef.current?.(textRef.current);
          }
          emitCommit(textRef.current);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (liveRafRef.current != null) {
              cancelAnimationFrame(liveRafRef.current);
              liveRafRef.current = null;
              onLiveRef.current?.(textRef.current);
            }
            emitCommit(textRef.current);
          }
          onKeyDown?.(e);
        }}
      />
    );
  }
);
