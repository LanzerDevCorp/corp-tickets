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

interface NewTicketEmailProps {
  ticketId: string;
  submitterName: string;
  submitterEmail: string;
  subject: string;
  priority: "low" | "medium" | "high" | "urgent";
  categoryName: string;
  body: string;
  dashboardUrl: string;
}

const priorityColors: Record<
  NewTicketEmailProps["priority"],
  { color: string; fontWeight?: string }
> = {
  low: { color: "#666" },
  medium: { color: "#b45309" },
  high: { color: "#c2410c" },
  urgent: { color: "#dc2626", fontWeight: "700" },
};

export default function NewTicketEmail({
  ticketId: _ticketId,
  submitterName,
  submitterEmail,
  subject,
  priority,
  categoryName,
  body,
  dashboardUrl,
}: NewTicketEmailProps) {
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
            {"Se ha enviado un nuevo ticket de soporte."}
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
            {subject}
          </Heading>

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#444",
              margin: "0 0 8px",
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

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#444",
              margin: "0 0 16px",
            }}
          >
            {"De:"} {submitterName} &lt;{submitterEmail}&gt;
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
            {body}
          </Text>

          <Button
            href={dashboardUrl}
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
            {"Ver en el panel"}
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
