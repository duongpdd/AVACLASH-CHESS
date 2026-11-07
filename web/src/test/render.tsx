import type { ReactNode } from "react";
import {
  render as renderBase,
  renderHook as renderHookBase,
  type RenderOptions,
  type RenderHookOptions,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/vi.json";

export * from "@testing-library/react";

function withMessages(Wrapper?: RenderOptions["wrapper"]) {
  return function TestProviders({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider
        locale="vi"
        messages={messages}
        timeZone="Asia/Ho_Chi_Minh"
      >
        {Wrapper ? <Wrapper>{children}</Wrapper> : children}
      </NextIntlClientProvider>
    );
  };
}

export function render(ui: ReactNode, options?: RenderOptions) {
  return renderBase(ui, {
    ...options,
    wrapper: withMessages(options?.wrapper),
  });
}

export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options?: RenderHookOptions<Props>,
) {
  return renderHookBase(callback, {
    ...options,
    wrapper: withMessages(options?.wrapper),
  });
}
