import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
} from "@react-email/components";

interface TicketResolvedEmailProps {
  clientName: string;
  ticketSubject: string;
  trackingUrl: string;
}

export default function TicketResolvedEmail({
  clientName,
  ticketSubject,
  trackingUrl,
}: TicketResolvedEmailProps) {
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
            {`Hola ${clientName},`}
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
              margin: "0 0 24px",
            }}
          >
            {"Tu ticket ha sido marcado como resuelto por nuestro equipo."}
          </Text>

          <Button
            href={trackingUrl}
            style={{
              backgroundColor: "#16a34a",
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
            {"Ver historial del ticket"}
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
            {"Esta es una notificación automática del sistema de tickets."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
