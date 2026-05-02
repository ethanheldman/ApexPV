// A number input that selects its current value on focus. Stops the
// "0 stuck at the start" issue: tapping a field with "13" or "0" highlights
// the contents so the next keypress replaces it instead of inserting before it.
//
// Use `decimal` to bring up iOS's decimal keypad; otherwise it's the integer
// keypad. Default-empty defaults to "decimal" since most fields take fractions.

import { forwardRef } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode"> & {
  decimal?: boolean;
};

const NumberField = forwardRef<HTMLInputElement, Props>(function NumberField(
  { decimal, onFocus, onClick, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode={decimal ? "decimal" : "numeric"}
      onFocus={(e) => {
        // iOS Safari occasionally drops select() if it fires synchronously
        // with focus; defer to the next frame so the selection sticks.
        const el = e.currentTarget;
        requestAnimationFrame(() => {
          try {
            el.select();
          } catch {}
        });
        onFocus?.(e);
      }}
      onClick={(e) => {
        // Tap on an already-focused field should also re-select.
        const el = e.currentTarget;
        if (document.activeElement === el) el.select();
        onClick?.(e);
      }}
      {...rest}
    />
  );
});

export default NumberField;
