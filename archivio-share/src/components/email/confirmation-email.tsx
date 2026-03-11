import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface ConfirmationEmailProps {
  cancelUrl: string;
  deliverAtLabel: string;
}

export function ConfirmationEmail({ cancelUrl, deliverAtLabel }: ConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your time capsule is sealed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Time capsule sealed</Heading>
          <Text style={p}>
            Your photo and message will be delivered to your inbox on {deliverAtLabel}.
          </Text>
          <Text style={p}>
            Changed your mind?{" "}
            <Link href={cancelUrl} style={link}>
              Cancel this capsule
            </Link>
          </Text>
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
const p = { color: "#555", fontSize: "14px", lineHeight: "24px" };
const link = { color: "#5469d4", textDecoration: "underline" };
const hr = { borderColor: "#e6ebf1", margin: "20px 0" };
const footer = { color: "#8898aa", fontSize: "12px" };

export default ConfirmationEmail;
