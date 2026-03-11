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

interface CapsuleEmailProps {
  photoUrl: string;
  message: string;
  eventName?: string;
  eventDate?: string;
  eventLocation?: string;
}

export function CapsuleEmail({
  photoUrl,
  message,
  eventName,
  eventDate,
  eventLocation,
}: CapsuleEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your time capsule has arrived</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your time capsule has arrived</Heading>
          <Section style={section}>
            <Img src={photoUrl} alt="Your photo" width="100%" style={img} />
          </Section>
          <Text style={p}>{message}</Text>
          {(eventName || eventDate || eventLocation) && (
            <>
              <Hr style={hr} />
              <Text style={caption}>
                {eventName && <strong>{eventName}</strong>}
                {eventDate && <> · {eventDate}</>}
                {eventLocation && <> · {eventLocation}</>}
              </Text>
            </>
          )}
          <Hr style={hr} />
          <Text style={footer}>Archivio · Photobooth time capsules</Text>
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
const p = { color: "#333", fontSize: "14px", lineHeight: "24px", whiteSpace: "pre-wrap" as const };
const caption = { color: "#666", fontSize: "12px" };
const hr = { borderColor: "#e6ebf1", margin: "20px 0" };
const footer = { color: "#8898aa", fontSize: "12px" };

export default CapsuleEmail;
