import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import { es } from "@/lib/i18n/es";

interface TicketClosedEmailProps {
  clientName: string;
  ticketSubject: string;
  closureReason: string;
  trackingUrl: string;
}

export default function TicketClosedEmail({
  clientName,
  ticketSubject,
  closureReason,
  trackingUrl,
}: TicketClosedEmailProps) {
  return (
    <Html lang="es-MX">
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: "0",
          padding: "0",
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            padding: "0 20px",
          }}
        >
          <Text
            style={{
              fontSize: "16px",
              lineHeight: "1.5",
              color: "#1a1a1a",
              margin: "0 0 16px",
            }}
          >
            {es.email.ticketClosed.greeting.replace("{name}", clientName)}
          </Text>

          <Heading
            as="h2"
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1a1a1a",
              margin: "0 0 12px",
              lineHeight: "1.3",
            }}
          >
            {ticketSubject}
          </Heading>

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#444",
              margin: "0 0 16px",
            }}
          >
            {es.email.ticketClosed.intro}
          </Text>

          <Text
            style={{
              fontSize: "15px",
              lineHeight: "1.6",
              color: "#1a1a1a",
              backgroundColor: "#f4f4f4",
              padding: "16px",
              borderRadius: "4px",
              whiteSpace: "pre-wrap",
              margin: "0 0 24px",
            }}
          >
            {closureReason}
          </Text>

          <Button
            href={trackingUrl}
            style={{
              backgroundColor: "#1a1a1a",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              display: "inline-block",
              marginBottom: "24px",
            }}
          >
            {es.email.ticketClosed.viewHistory}
          </Button>

          <Hr
            style={{
              border: "none",
              borderTop: "1px solid #eaeaea",
              margin: "0 0 16px",
            }}
          />

          <Text
            style={{
              fontSize: "12px",
              lineHeight: "1.5",
              color: "#666",
              margin: "0",
            }}
          >
            {es.email.ticketClosed.footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
