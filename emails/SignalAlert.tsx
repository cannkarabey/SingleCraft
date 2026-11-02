import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { emailCopy, type EmailLocale } from "./copy";
import * as s from "./styles";

export type SignalAlertProps = {
  locale: EmailLocale;
  appUrl: string;
  unsubscribeUrl: string;
  nicheName: string;
  story: {
    id: string;
    title: string | null;
    summary: string | null;
    slug: string | null;
    score: number;
  };
};

export function SignalAlert({
  locale,
  appUrl,
  unsubscribeUrl,
  nicheName,
  story,
}: SignalAlertProps) {
  const t = emailCopy(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{story.title ?? ""}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Text style={{ ...s.muted, fontFamily: "monospace" }}>
            SignalCraft
          </Text>
          <Heading as="h1" style={{ fontSize: "20px", margin: "8px 0" }}>
            {t("alertTitle")}
          </Heading>
          <Section style={s.card}>
            <Text
              style={{
                ...s.muted,
                fontFamily: "monospace",
                color: s.colors.accent,
              }}
            >
              {t("alertNiche", {
                niche: nicheName,
                score: Math.round(story.score),
              })}
            </Text>
            <Link
              href={`${appUrl}/discover/${story.slug ?? story.id}`}
              style={{ ...s.link, fontWeight: 600 }}
            >
              {story.title}
            </Link>
            {story.summary && <Text style={s.muted}>{story.summary}</Text>}
            <Link
              href={`${appUrl}/studio/new?story=${story.id}`}
              style={s.button}
            >
              {t("createBrief")}
            </Link>
          </Section>
          <Text style={s.footer}>
            {t("footer")}{" "}
            <Link href={unsubscribeUrl} style={s.link}>
              {t("unsubscribe")}
            </Link>{" "}
            ·{" "}
            <Link href={`${appUrl}/settings`} style={s.link}>
              {t("manage")}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
