import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
} from "@react-email/components";

interface TicketCreatedEmailProps {
  clientName: string;
  ticketSubject: string;
  priority: "low" | "medium" | "high" | "urgent";
  categoryName: string;
  magicLinkUrl: string;
}

const priorityConfig: Record<
  TicketCreatedEmailProps["priority"],
  { label: string; color: string; fontWeight?: string }
> = {
  low: { label: "Low", color: "#666" },
  medium: { label: "Medium", color: "#b45309" },
  high: { label: "High", color: "#c2410c" },
  urgent: { label: "URGENT", color: "#dc2626", fontWeight: "700" },
};

export default function TicketCreatedEmail({
  clientName,
  ticketSubject,
  priority,
  categoryName,
  magicLinkUrl,
}: TicketCreatedEmailProps) {
  const pConfig = priorityConfig[priority] ?? priorityConfig.low;

  return (
    <Html lang="en">
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
            Hi {clientName},
          </Text>

          <Text
            style={{
              fontSize: "16px",
              lineHeight: "1.5",
              color: "#1a1a1a",
              margin: "0 0 16px",
            }}
          >
            Your support ticket has been received. Use the link below to track
            its status and reply to our team.
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
            Priority:{" "}
            <span
              style={{
                color: pConfig.color,
                fontWeight: pConfig.fontWeight ?? "normal",
              }}
            >
              {pConfig.label}
            </span>
            {"  ·  "}
            Category: {categoryName}
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
            Track your ticket
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
            This link expires after a period of inactivity. If it stops working,
            request a new one from the error page.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
