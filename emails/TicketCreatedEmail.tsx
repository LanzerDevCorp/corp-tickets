import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import { priorityLabel } from "@/lib/labels";

interface TicketCreatedEmailProps {
  clientName: string;
  ticketSubject: string;
  ticketReference: string;
  priority: "low" | "medium" | "high" | "urgent";
  categoryName: string;
  magicLinkUrl: string;
}

const priorityColors: Record<
  TicketCreatedEmailProps["priority"],
  { color: string; fontWeight?: string }
> = {
  low: { color: "#666" },
  medium: { color: "#b45309" },
  high: { color: "#c2410c" },
  urgent: { color: "#dc2626", fontWeight: "700" },
};

export default function TicketCreatedEmail({
  clientName,
  ticketSubject,
  ticketReference,
  priority,
  categoryName,
  magicLinkUrl,
}: TicketCreatedEmailProps) {
  const pConfig = priorityColors[priority] ?? priorityColors.low;

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

          <Text
            style={{
              fontSize: "16px",
              lineHeight: "1.5",
              color: "#1a1a1a",
              margin: "0 0 16px",
            }}
          >
            {
              "Recibimos tu ticket de soporte. Usa el enlace de abajo para ver su estado y responder a nuestro equipo."
            }
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
              fontSize: "13px",
              lineHeight: "1.5",
              color: "#666",
              margin: "0 0 16px",
              fontFamily: "monospace",
            }}
          >
            {"Número de ticket:"} #{ticketReference}
          </Text>

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#444",
              margin: "0 0 24px",
            }}
          >
            {"Prioridad:"}{" "}
            <span
              style={{
                color: pConfig.color,
                fontWeight: pConfig.fontWeight ?? "normal",
              }}
            >
              {priorityLabel(priority)}
            </span>
            {"  ·  "}
            {"Categoría:"} {categoryName}
          </Text>

          <Button
            href={magicLinkUrl}
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
            {"Seguir tu ticket"}
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
            {
              "Guarda tu número de ticket. Si caduca la sesión, podrás volver a entrar con tu correo y ese número en la página de seguimiento."
            }
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
