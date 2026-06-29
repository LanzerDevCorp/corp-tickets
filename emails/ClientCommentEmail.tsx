import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Button,
} from "@react-email/components";

interface ClientCommentEmailProps {
  clientName: string;
  ticketSubject: string;
  commentBody: string;
  ticketReference: string;
  trackingUrl: string;
}

export default function ClientCommentEmail({
  clientName,
  ticketSubject,
  commentBody,
  ticketReference,
  trackingUrl,
}: ClientCommentEmailProps) {
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
            {`Nuevo comentario de ${clientName}:`}
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
            {commentBody}
          </Text>

          <Text
            style={{
              fontSize: "13px",
              lineHeight: "1.5",
              color: "#666",
              margin: "0 0 16px",
              fontFamily: "monospace",
            }}
          >
            {"Número de ticket:"} #{ticketReference}
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
            {"Ver ticket"}
          </Button>

          <hr
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
