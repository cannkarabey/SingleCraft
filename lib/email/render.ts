import { render } from "@react-email/components";
import { createElement } from "react";
import { emailCopy } from "@/emails/copy";
import { DailyDigest, type DailyDigestProps } from "@/emails/DailyDigest";
import { SignalAlert, type SignalAlertProps } from "@/emails/SignalAlert";

export type RenderedEmail = { subject: string; html: string; text: string };

async function both(element: React.ReactElement) {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}

export async function renderDigest(
  props: DailyDigestProps,
): Promise<RenderedEmail> {
  return {
    subject: emailCopy(props.locale)("digestSubject"),
    ...(await both(createElement(DailyDigest, props))),
  };
}

export async function renderAlert(
  props: SignalAlertProps,
): Promise<RenderedEmail> {
  return {
    subject: emailCopy(props.locale)("alertSubject", {
      title: props.story.title ?? "",
    }),
    ...(await both(createElement(SignalAlert, props))),
  };
}
