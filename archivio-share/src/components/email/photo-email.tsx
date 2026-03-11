import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface PhotoEmailProps {
  photoUrl: string;
  pageUrl?: string;
}

export function PhotoEmail({ photoUrl, pageUrl = "https://share.archivio.app" }: PhotoEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your photobooth photo</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your photo</Heading>
          <Section style={section}>
            <Img src={photoUrl} alt="Your photobooth photo" width="100%" style={img} />
          </Section>
          {pageUrl && (
            <>
              <Hr style={hr} />
              <Text style={footer}>
                <a href={pageUrl} style={link}>View online</a> · Share, save, or create a time capsule.
              </Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { margin: "0 auto", padding: "20px", maxWidth: "560px" };
const h1 = { color: "#333", fontSize: "20px", marginBottom: "16px" };
const section = { margin: "24px 0" };
const img = { maxWidth: "100%", height: "auto", borderRadius: "8px" };
const hr = { borderColor: "#e6ebf1", margin: "20px 0" };
const footer = { color: "#8898aa", fontSize: "12px" };
const link = { color: "#5469d4", textDecoration: "underline" };

export default PhotoEmail;
