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

export type DigestStory = {
  id: string;
  title: string | null;
  summary: string | null;
  slug: string | null;
};

export type DailyDigestProps = {
  locale: EmailLocale;
  appUrl: string;
  unsubscribeUrl: string;
  stories: DigestStory[];
  publishCheck: { briefId: string; storyTitle: string | null } | null;
};

export function DailyDigest({
  locale,
  appUrl,
  unsubscribeUrl,
  stories,
  publishCheck,
}: DailyDigestProps) {
  const t = emailCopy(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t("digestIntro")}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Text style={{ ...s.muted, fontFamily: "monospace" }}>
            SignalCraft
          </Text>
          <Heading as="h1" style={{ fontSize: "22px", margin: "8px 0" }}>
            {t("digestTitle")}
          </Heading>
          <Text style={s.muted}>{t("digestIntro")}</Text>
          {stories.map((story) => (
            <Section key={story.id} style={s.card}>
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
          ))}
          {publishCheck && (
            <Section style={s.card}>
              <Text style={{ margin: 0, fontWeight: 600 }}>
                {t("publishCheck")}
              </Text>
              <Text style={s.muted}>
                {t("publishCheckBody", {
                  title: publishCheck.storyTitle ?? "",
                })}
              </Text>
              <Link
                href={`${appUrl}/studio/${publishCheck.briefId}`}
                style={s.button}
              >
                {t("publishCheck")}
              </Link>
            </Section>
          )}
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
