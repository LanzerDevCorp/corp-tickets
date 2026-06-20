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
import { priorityLabel } from "@/lib/i18n/maps";

interface TicketCreatedEmailProps {
  clientName: string;
  ticketSubject: string;
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
            {es.email.ticketCreated.greeting.replace("{name}", clientName)}
          </Text>

          <Text
            style={{
              fontSize: "16px",
              lineHeight: "1.5",
              color: "#1a1a1a",
              margin: "0 0 16px",
            }}
          >
            {es.email.ticketCreated.intro}
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
            {es.email.ticketCreated.priority}{" "}
            <span
              style={{
                color: pConfig.color,
                fontWeight: pConfig.fontWeight ?? "normal",
              }}
            >
              {priorityLabel(priority)}
            </span>
            {"  ·  "}
            {es.email.ticketCreated.category} {categoryName}
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
            {es.email.ticketCreated.trackButton}
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
            {es.email.ticketCreated.footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
